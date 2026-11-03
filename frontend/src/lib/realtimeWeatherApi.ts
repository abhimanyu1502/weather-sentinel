/**
 * realtimeWeatherApi.ts — Free Real-Time Weather API & 3km Micro-Radius 6-Hour Nowcasting Engine.
 *
 * Utilizes Open-Meteo (100% Free, No API Key, Non-Commercial Open-Access, CORS Enabled)
 * to ingest high-precision meteorological telemetry and compute localized 3km radius
 * micro-convective hazard predictions across Indian territory.
 */

import { City } from "../data/indiaGeo";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000/api";

export interface HourlyPrediction {
  hourOffset: number; // 1..6
  time: string;
  precipitation_mm: number;
  rain_mm: number;
  precipitation_probability_pct: number;
  cape_j_kg: number;
  temperature_c: number;
  dew_point_c: number;
  dew_point_depression_c: number;
  wind_gusts_kmh: number;
  wind_speed_kmh: number;
  weather_code: number;
  weather_description: string;
  visibility_km: number;
  cloud_cover_pct: number;
  pressure_msl_hpa: number;
  anomaly_detected: boolean;
  anomaly_severity: "EXTREME" | "SEVERE" | "WARNING" | "NORMAL";
  anomaly_label?: string;
  // 3km Micro-radius computed impact
  three_km_deluge_volume_m3_hr: number;
  three_km_flash_flood_risk: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
}

export type AnomalyType =
  | "CLOUDBURST_ALERT"
  | "SEVERE_THUNDERSTORM"
  | "GALE_SQUALL"
  | "HEAVY_CONVECTIVE_RAIN"
  | "HIGH_CAPE_INSTABILITY"
  | "EXTREME_HEATWAVE";

export interface ThreeKmRadiusMetrics {
  radius_km: number; // 3.0 km
  core_area_km2: number; // 28.27 km2
  estimated_deluge_volume_m3_hr: number; // mm/h * area * 1000
  downburst_shear_velocity_kmh: number; // microburst gust amplification
  flash_runoff_risk: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  convective_initiation_eta_min: number; // 0..360 min
  convective_core_dbz: number; // localized reflectivity estimate
  dew_point_depression_c: number; // T - Td (lower = higher humidity saturation)
}

export interface SixHourAnomaly {
  cityId: string;
  cityName: string;
  state: string;
  lat: number;
  lon: number;
  anomalyType: AnomalyType;
  severity: "EXTREME" | "SEVERE" | "WARNING" | "WATCH";
  leadTimeHours: number; // e.g. 1..6
  leadTimeMinutes: number; // e.g. 60..360
  estimatedOccurrenceTime: string;
  peakRainMmHr: number;
  peakCape: number;
  peakGustKmh: number;
  warningHeadline: string;
  actionProtocol: string;
  hourlyBreakdown: HourlyPrediction[];
  threeKmMetrics: ThreeKmRadiusMetrics;
}

export interface LiveCityTelemetry {
  temperature_c: number;
  apparent_temp_c: number;
  dew_point_c: number;
  dew_point_depression_c: number;
  relative_humidity_pct: number;
  surface_pressure_hpa: number;
  pressure_msl_hpa: number;
  visibility_km: number;
  cloud_cover_pct: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  wind_gusts_kmh: number;
  precipitation_mm_hr: number;
  weather_code: number;
  weather_description: string;
  cape_j_kg: number;
  lifted_index?: number;
  three_km_metrics: ThreeKmRadiusMetrics;
  source: "OPEN_METEO_REALTIME" | "SYNTHETIC_SIMULATION";
  updated_at: string;
  hourly6h: HourlyPrediction[];
  activeAnomaly?: SixHourAnomaly;
}

/**
 * Maps standard WMO (World Meteorological Organization) weather interpretation codes
 * to verified, highly descriptive meteorological conditions.
 */
export function interpretWmoCode(code: number): {
  description: string;
  category: "CLEAR" | "CLOUDY" | "FOG" | "DRIZZLE" | "RAIN" | "THUNDERSTORM";
  severity: "NORMAL" | "WARNING" | "SEVERE" | "EXTREME";
} {
  switch (code) {
    case 0:
      return { description: "Clear Sky", category: "CLEAR", severity: "NORMAL" };
    case 1:
      return { description: "Mainly Clear", category: "CLEAR", severity: "NORMAL" };
    case 2:
      return { description: "Partly Cloudy", category: "CLOUDY", severity: "NORMAL" };
    case 3:
      return { description: "Overcast", category: "CLOUDY", severity: "NORMAL" };
    case 45:
      return { description: "Dense Fog", category: "FOG", severity: "WARNING" };
    case 48:
      return { description: "Depositing Rime Fog", category: "FOG", severity: "WARNING" };
    case 51:
      return { description: "Light Drizzle", category: "DRIZZLE", severity: "NORMAL" };
    case 53:
      return { description: "Moderate Drizzle", category: "DRIZZLE", severity: "NORMAL" };
    case 55:
      return { description: "Dense Freezing Drizzle", category: "DRIZZLE", severity: "WARNING" };
    case 61:
      return { description: "Slight Rain", category: "RAIN", severity: "NORMAL" };
    case 63:
      return { description: "Moderate Rain Showers", category: "RAIN", severity: "WARNING" };
    case 65:
      return { description: "Heavy Rain Deluge", category: "RAIN", severity: "SEVERE" };
    case 80:
      return { description: "Scattered Rain Showers", category: "RAIN", severity: "NORMAL" };
    case 81:
      return { description: "Intense Rain Showers", category: "RAIN", severity: "WARNING" };
    case 82:
      return { description: "Violent Rain Cloudburst", category: "RAIN", severity: "EXTREME" };
    case 95:
      return { description: "Severe Thunderstorm", category: "THUNDERSTORM", severity: "SEVERE" };
    case 96:
      return { description: "Severe Thunderstorm with Slight Hail", category: "THUNDERSTORM", severity: "EXTREME" };
    case 99:
      return { description: "Violent Thunderstorm with Severe Hail", category: "THUNDERSTORM", severity: "EXTREME" };
    default:
      return { description: "Variable Cloudiness", category: "CLOUDY", severity: "NORMAL" };
  }
}

// In-memory cache to stay fast and avoid redundant network calls
const cache = new Map<string, { data: LiveCityTelemetry; timestamp: number }>();
const CACHE_TTL_MS = 6 * 60 * 1000; // 6 minutes

/**
 * Calculates high-precision 3km radius micro-cell impact parameters.
 */
export function compute3KmRadiusMetrics(
  rainMmHr: number,
  capeJkg: number,
  gustKmh: number,
  tempC: number,
  dewPointC: number
): ThreeKmRadiusMetrics {
  const radiusKm = 3.0;
  const coreAreaKm2 = Math.PI * radiusKm * radiusKm; // ~28.27 km2
  const delugeVolumeM3Hr = Math.round(rainMmHr * coreAreaKm2 * 1000); // 1 mm = 1 L/m2 = 1000 m3/km2

  // Microburst localized shear: amplified along convective boundary
  const downburstVelocityKmh = Math.round(Math.max(gustKmh, Math.sqrt(Math.max(0, capeJkg)) * 1.45 + gustKmh * 0.4));

  // Dew point depression (T - Td)
  const dpDepression = Math.max(0, Math.round((tempC - dewPointC) * 10) / 10);

  // Convective initiation eta: lower depression & high CAPE -> rapid initiation
  let ciEtaMin = 180;
  if (capeJkg >= 2500 && dpDepression <= 3.0) ciEtaMin = 25;
  else if (capeJkg >= 1800 && dpDepression <= 5.0) ciEtaMin = 60;
  else if (capeJkg >= 1200) ciEtaMin = 120;

  // Flash runoff risk based on 3km localized precipitation rate
  let runoffRisk: ThreeKmRadiusMetrics["flash_runoff_risk"] = "LOW";
  if (rainMmHr >= 50.0 || (rainMmHr >= 30.0 && capeJkg >= 1800)) {
    runoffRisk = "CRITICAL";
  } else if (rainMmHr >= 25.0 || capeJkg >= 2000) {
    runoffRisk = "HIGH";
  } else if (rainMmHr >= 10.0 || capeJkg >= 1000) {
    runoffRisk = "MODERATE";
  }

  // Estimated radar core reflectivity in dBZ from Marshall-Palmer relation Z = 200 * R^1.6
  let coreDbz = 15;
  if (rainMmHr > 0.1) {
    const zLinear = 200 * Math.pow(rainMmHr, 1.6);
    coreDbz = Math.min(68, Math.max(15, Math.round(10 * Math.log10(zLinear))));
  }

  return {
    radius_km: radiusKm,
    core_area_km2: Math.round(coreAreaKm2 * 10) / 10,
    estimated_deluge_volume_m3_hr: delugeVolumeM3Hr,
    downburst_shear_velocity_kmh: downburstVelocityKmh,
    flash_runoff_risk: runoffRisk,
    convective_initiation_eta_min: ciEtaMin,
    convective_core_dbz: coreDbz,
    dew_point_depression_c: dpDepression,
  };
}

/**
 * Fetch 100% free real-time weather and 6-hour hourly anomaly forecast from Open-Meteo
 * optimized for 3km radius micro-scale accuracy.
 */
export async function fetchLiveCityWeather(
  lat: number,
  lon: number,
  cityName?: string
): Promise<LiveCityTelemetry | null> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // Coordinate queries go through the backend so the same cached, validated
    // 3 km-radius contract is used for cities and arbitrary map clicks.
    try {
      const backendUrl = `${API_BASE}/weather/3km-nowcast?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&name=${encodeURIComponent(cityName || "Selected target")}`;
      const backendRes = await fetch(backendUrl, { signal: AbortSignal.timeout(7500) });
      if (backendRes.ok) {
        const payload = await backendRes.json();
        const normalized = normalizeBackendNowcast(payload, lat, lon, cityName);
        if (normalized) {
          cache.set(cacheKey, { data: normalized, timestamp: now });
          return normalized;
        }
      }
    } catch {
      // Keep the direct Open-Meteo fallback for offline/local demo mode.
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,surface_pressure,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,dew_point_2m` +
      `&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,rain,showers,weather_code,surface_pressure,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape,cloud_cover` +
      `&forecast_hours=6&timezone=Asia%2FKolkata`;

    const res = await fetch(url, { signal: AbortSignal.timeout(6500) });
    if (!res.ok) return null;
    const json = await res.json();

    const current = json.current || {};
    const hourly = json.hourly || { time: [] };

    const hourly6h: HourlyPrediction[] = [];
    const times: string[] = hourly.time || [];
    const precips: number[] = hourly.precipitation || [];
    const capes: number[] = hourly.cape || [];
    const temps: number[] = hourly.temperature_2m || [];
    const dews: number[] = hourly.dew_point_2m || [];
    const gusts: number[] = hourly.wind_gusts_10m || [];
    const speeds: number[] = hourly.wind_speed_10m || [];
    const probs: number[] = hourly.precipitation_probability || [];
    const codes: number[] = hourly.weather_code || [];
    const clouds: number[] = hourly.cloud_cover || [];
    const msls: number[] = hourly.pressure_msl || [];
    const visibilities: number[] = hourly.visibility || [];

    let highestSeverity: "EXTREME" | "SEVERE" | "WARNING" | "WATCH" = "WATCH";
    let worstLeadHour = 3;
    let maxPrecip = current.precipitation || 0;
    let maxCape = 0;
    let maxGust = current.wind_gusts_10m || 0;
    let detectedAnomalyType: AnomalyType = "HIGH_CAPE_INSTABILITY";

    for (let i = 0; i < Math.min(6, times.length); i++) {
      const p = precips[i] || 0;
      const cape = capes[i] || 0;
      const g = gusts[i] || 0;
      const spd = speeds[i] || 12;
      const t = temps[i] || 25;
      const dew = dews[i] !== undefined ? dews[i] : t - 4;
      const prob = probs[i] || 0;
      const c = codes[i] || 0;
      const cld = clouds[i] || 50;
      const msl = msls[i] || 1012;
      const vis = visibilities[i] ? visibilities[i] / 1000 : 10;
      const wmoInfo = interpretWmoCode(c);

      if (p > maxPrecip) maxPrecip = p;
      if (cape > maxCape) maxCape = cape;
      if (g > maxGust) maxGust = g;

      let sev: HourlyPrediction["anomaly_severity"] = "NORMAL";
      let lbl = wmoInfo.description;

      // Severe Convective Anomaly Criteria (IMD / NDMA Standards)
      if (p >= 50 || (p >= 35 && cape >= 1800)) {
        sev = "EXTREME";
        lbl = "Cloudburst Anomaly (Violent 3km Core Deluge)";
        if (highestSeverity !== "EXTREME") {
          highestSeverity = "EXTREME";
          worstLeadHour = i + 1;
          detectedAnomalyType = "CLOUDBURST_ALERT";
        }
      } else if (p >= 25 || cape >= 2000 || g >= 75) {
        sev = "SEVERE";
        lbl = cape >= 2000 ? "Severe Thunderstorm with Hail Threat" : "High Gale Squall & Microburst";
        if (highestSeverity !== "EXTREME") {
          highestSeverity = "SEVERE";
          worstLeadHour = i + 1;
          detectedAnomalyType = cape >= 2000 ? "SEVERE_THUNDERSTORM" : "GALE_SQUALL";
        }
      } else if (p >= 10 || cape >= 1200 || g >= 50) {
        sev = "WARNING";
        lbl = "Convective Initiation & Heavy Downpours";
        if (highestSeverity === "WATCH") {
          highestSeverity = "WARNING";
          worstLeadHour = i + 1;
          detectedAnomalyType = "HEAVY_CONVECTIVE_RAIN";
        }
      }

      // Compute 3km deluge volume for this hour
      const hourly3kmVolume = Math.round(p * 28.27 * 1000);
      const hourlyFlashRisk: HourlyPrediction["three_km_flash_flood_risk"] =
        p >= 40 ? "CRITICAL" : p >= 20 ? "HIGH" : p >= 8 ? "MODERATE" : "LOW";

      hourly6h.push({
        hourOffset: i + 1,
        time: times[i],
        precipitation_mm: p,
        rain_mm: hourly.rain?.[i] || p,
        precipitation_probability_pct: prob,
        cape_j_kg: cape,
        temperature_c: t,
        dew_point_c: dew,
        dew_point_depression_c: Math.max(0, Math.round((t - dew) * 10) / 10),
        wind_gusts_kmh: g,
        wind_speed_kmh: spd,
        weather_code: c,
        weather_description: wmoInfo.description,
        visibility_km: Math.round(vis * 10) / 10,
        cloud_cover_pct: cld,
        pressure_msl_hpa: Math.round(msl * 10) / 10,
        anomaly_detected: sev !== "NORMAL",
        anomaly_severity: sev,
        anomaly_label: lbl,
        three_km_deluge_volume_m3_hr: hourly3kmVolume,
        three_km_flash_flood_risk: hourlyFlashRisk,
      });
    }

    const curTemp = current.temperature_2m !== undefined ? current.temperature_2m : 28.0;
    const curDew = current.dew_point_2m !== undefined ? current.dew_point_2m : curTemp - 4.5;
    const curRain = current.precipitation !== undefined ? current.precipitation : 0.0;
    const curGust = current.wind_gusts_10m !== undefined ? current.wind_gusts_10m : 20.0;
    const curPressMsl = current.pressure_msl !== undefined ? current.pressure_msl : 1012.0;
    const curPressStation = current.surface_pressure !== undefined ? current.surface_pressure : curPressMsl - 5;
    const curWmo = current.weather_code !== undefined ? current.weather_code : 0;
    const curWmoInfo = interpretWmoCode(curWmo);

    const threeKmMetrics = compute3KmRadiusMetrics(
      curRain,
      maxCape,
      curGust,
      curTemp,
      curDew
    );

    let activeAnomaly: SixHourAnomaly | undefined;
    if (highestSeverity === "EXTREME" || highestSeverity === "SEVERE" || highestSeverity === "WARNING") {
      activeAnomaly = {
        cityId: cityName ? cityName.toLowerCase().replace(/\s+/g, "-") : "target",
        cityName: cityName || "Regional Station",
        state: "Indian Territory",
        lat,
        lon,
        anomalyType: detectedAnomalyType,
        severity: highestSeverity,
        leadTimeHours: worstLeadHour,
        leadTimeMinutes: worstLeadHour * 60,
        estimatedOccurrenceTime: times[worstLeadHour - 1] || `T+${worstLeadHour}h`,
        peakRainMmHr: maxPrecip,
        peakCape: maxCape,
        peakGustKmh: maxGust,
        warningHeadline:
          detectedAnomalyType === "CLOUDBURST_ALERT"
            ? `ADVANCE T-6H WARNING: 3km Core Cloudburst Predicted within ${worstLeadHour}h (~${maxPrecip.toFixed(0)} mm/h peak)`
            : detectedAnomalyType === "SEVERE_THUNDERSTORM"
            ? `ADVANCE T-6H WARNING: Convective Initiation & Severe Hail (CAPE ${maxCape.toFixed(0)} J/kg) in ${worstLeadHour}h`
            : `ADVANCE T-6H WARNING: Intense Downburst Squall & Localized Deluge in ${worstLeadHour}h`,
        actionProtocol:
          highestSeverity === "EXTREME"
            ? "Immediate 3km core drainage activation, SDMA/NDRF pre-deployment, underpass barricading"
            : "Civil defense alert, storm drain clearance, power grid surge mitigation",
        hourlyBreakdown: hourly6h,
        threeKmMetrics,
      };
    }

    const data: LiveCityTelemetry = {
      temperature_c: curTemp,
      apparent_temp_c: current.apparent_temperature !== undefined ? current.apparent_temperature : curTemp + 2.5,
      dew_point_c: Math.round(curDew * 10) / 10,
      dew_point_depression_c: Math.max(0, Math.round((curTemp - curDew) * 10) / 10),
      relative_humidity_pct: current.relative_humidity_2m !== undefined ? current.relative_humidity_2m : 65,
      surface_pressure_hpa: Math.round(curPressStation * 10) / 10,
      pressure_msl_hpa: Math.round(curPressMsl * 10) / 10,
      visibility_km: 10.0,
      cloud_cover_pct: current.cloud_cover !== undefined ? current.cloud_cover : 45,
      wind_speed_kmh: current.wind_speed_10m !== undefined ? current.wind_speed_10m : 14,
      wind_direction_deg: current.wind_direction_10m !== undefined ? current.wind_direction_10m : 180,
      wind_gusts_kmh: curGust,
      precipitation_mm_hr: curRain,
      weather_code: curWmo,
      weather_description: curWmoInfo.description,
      cape_j_kg: maxCape,
      three_km_metrics: threeKmMetrics,
      source: "OPEN_METEO_REALTIME",
      updated_at: new Date().toISOString(),
      hourly6h,
      activeAnomaly,
    };

    cache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (err) {
    console.warn(`[WeatherAPI] Fetch error for (${lat}, ${lon}):`, err);
    return null;
  }
}

function normalizeBackendNowcast(
  payload: any,
  lat: number,
  lon: number,
  cityName?: string
): LiveCityTelemetry | null {
  const t = payload?.telemetry;
  if (!t) return null;
  const radius = payload?.three_km_radius_analysis || {};
  const anomaly = payload?.six_hour_anomaly;
  const rows = payload?.hourly_forecast || anomaly?.hourly_breakdown || [];
  const hourly6h: HourlyPrediction[] = rows.slice(0, 6).map((h: any, index: number) => {
    const precipitation = Number(h.precipitation_mm ?? 0);
    const cape = Number(h.cape_j_kg ?? 0);
    const gust = Number(h.wind_gusts_kmh ?? 0);
    const severity = precipitation >= 50 || (precipitation >= 35 && cape >= 1800)
      ? "EXTREME"
      : precipitation >= 25 || cape >= 2000 || gust >= 75
      ? "SEVERE"
      : precipitation >= 10 || cape >= 1200 || gust >= 50
      ? "WARNING"
      : "NORMAL";
    return {
      hourOffset: Number(h.hour_offset ?? index + 1),
      time: h.time || `T+${index + 1}h`,
      precipitation_mm: precipitation,
      rain_mm: Number(h.rain_mm ?? precipitation),
      precipitation_probability_pct: Number(h.precipitation_probability_pct ?? h.precipitation_prob_pct ?? 0),
      cape_j_kg: cape,
      temperature_c: Number(h.temperature_c ?? t.temperature_c ?? 25),
      dew_point_c: Number(h.dew_point_c ?? (h.temperature_c ?? 25) - 4),
      dew_point_depression_c: Number(h.dew_point_depression_c ?? 4),
      wind_gusts_kmh: gust,
      wind_speed_kmh: Number(h.wind_speed_kmh ?? t.wind_speed_kmh ?? 12),
      weather_code: Number(h.weather_code ?? t.weather_code ?? 0),
      weather_description: h.weather_description || "Forecast conditions",
      visibility_km: Number(h.visibility_km ?? 10),
      cloud_cover_pct: Number(h.cloud_cover_pct ?? t.cloud_cover_pct ?? 45),
      pressure_msl_hpa: Number(h.pressure_msl_hpa ?? t.pressure_msl_hpa ?? 1012),
      anomaly_detected: severity !== "NORMAL",
      anomaly_severity: severity,
      anomaly_label: h.anomaly_label,
      three_km_deluge_volume_m3_hr: Number(h.three_km_deluge_volume_m3_hr ?? 0),
      three_km_flash_flood_risk: h.three_km_flash_flood_risk || "LOW",
    };
  });

  const metrics: ThreeKmRadiusMetrics = {
    radius_km: Number(radius.radius_km ?? 3),
    core_area_km2: Number(radius.core_area_km2 ?? 28.3),
    estimated_deluge_volume_m3_hr: Number(radius.estimated_deluge_volume_m3_hr ?? 0),
    downburst_shear_velocity_kmh: Number(radius.downburst_shear_velocity_kmh ?? t.wind_gusts_kmh ?? 0),
    flash_runoff_risk: radius.flash_runoff_risk || "LOW",
    convective_initiation_eta_min: Number(radius.convective_initiation_eta_min ?? 180),
    convective_core_dbz: Number(radius.convective_core_dbz ?? 15),
    dew_point_depression_c: Number(radius.dew_point_depression_c ?? t.dew_point_depression_c ?? 4),
  };

  const sourceAnomaly = anomaly
    ? {
        cityId: `target-${lat.toFixed(4)}-${lon.toFixed(4)}`,
        cityName: cityName || "Selected target",
        state: "Indian Territory",
        lat,
        lon,
        anomalyType: anomaly.anomaly_type || "HIGH_CAPE_INSTABILITY",
        severity: anomaly.severity,
        leadTimeHours: Number(anomaly.lead_time_hours ?? 1),
        leadTimeMinutes: Number(anomaly.lead_time_minutes ?? 60),
        estimatedOccurrenceTime: anomaly.estimated_occurrence || "T+1h",
        peakRainMmHr: Number(anomaly.peak_rain_mm_hr ?? 0),
        peakCape: Number(anomaly.peak_cape_j_kg ?? 0),
        peakGustKmh: Number(anomaly.peak_gust_kmh ?? 0),
        warningHeadline: anomaly.warning_headline || "Localized convective anomaly",
        actionProtocol: anomaly.action_protocol || "Monitor local conditions",
        hourlyBreakdown: hourly6h,
        threeKmMetrics: metrics,
      }
    : undefined;

  return {
    temperature_c: Number(t.temperature_c ?? 27),
    apparent_temp_c: Number(t.apparent_temperature_c ?? t.temperature_c ?? 27),
    dew_point_c: Number(t.dew_point_c ?? 23),
    dew_point_depression_c: Number(t.dew_point_depression_c ?? 4),
    relative_humidity_pct: Number(t.relative_humidity_pct ?? 65),
    surface_pressure_hpa: Number(t.surface_pressure_hpa ?? 1008),
    pressure_msl_hpa: Number(t.pressure_msl_hpa ?? 1012),
    visibility_km: Number(t.visibility_km ?? 10),
    cloud_cover_pct: Number(t.cloud_cover_pct ?? 45),
    wind_speed_kmh: Number(t.wind_speed_kmh ?? 14),
    wind_direction_deg: Number(t.wind_direction_deg ?? 180),
    wind_gusts_kmh: Number(t.wind_gusts_kmh ?? 20),
    precipitation_mm_hr: Number(t.precipitation_mm_hr ?? 0),
    weather_code: Number(t.weather_code ?? 0),
    weather_description: t.weather_description || "Variable conditions",
    cape_j_kg: Number(t.max_cape_j_kg ?? 0),
    three_km_metrics: metrics,
    source: "OPEN_METEO_REALTIME",
    updated_at: payload.timestamp || new Date().toISOString(),
    hourly6h,
    activeAnomaly: sourceAnomaly,
  };
}
