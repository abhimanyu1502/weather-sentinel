/**
 * weatherEngine.ts — Deterministic real-time weather simulation across India.
 *
 * Produces physically-plausible, continuously evolving conditions for every city:
 *   • Monsoon-seasonal rainfall regime (SW monsoon Jun-Sep, NE monsoon Oct-Dec)
 *   • Western Ghats orographic enhancement, Bay-of-Bengal convective burst
 *   • Diurnal temperature cycle, humidity tied to rain proximity
 *   • Derived severe-weather indices (dBZ proxy, MESH, POSH, Z-R rain rate, gust)
 *
 * Runs fully client-side so the dashboard is usable with or without the backend.
 * If a live backend payload is present it is merged on top of these values.
 */

import { ALL_CITIES, INDIA_REGIONS, City, StateRegion } from "../data/indiaGeo";

export type HazardLevel = "NONE" | "WATCH" | "WARNING" | "SEVERE" | "EXTREME";

export interface CityWeather {
  cityId: string;
  cityName: string;
  state: string;
  lat: number;
  lon: number;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  windKmph: number;
  windDirDeg: number;
  pressureHpa: number;
  visibilityKm: number;
  rainMmHr: number;
  accumulatedMm: number;
  cloudCoverPct: number;
  reflectivityDbz: number;
  hailMeshMm: number;
  hailPoshPct: number;
  lightningFlashesKm2: number;
  gustKmph: number;
  ctcrKPer15min: number;
  hazard: HazardLevel;
  hazardScore: number; // 0..100 composite
  alertHeadline: string;
  updatedAt: string;
}

export interface CountdownTarget {
  target_name: string;
  lat: number;
  lon: number;
  distance_km: number;
  eta_seconds: number;
  hazard_level: "RED_ALERT" | "ORANGE_ALERT" | "YELLOW_ALERT" | string;
  category: string;
}

export interface NowcastTimestep {
  lead_time_min: number;
  predicted_max_dbz: number;
  predicted_max_rain_rate_mm_hr: number;
  predicted_lightning_activity: number;
  predicted_peak_gust_kmh: number;
}

export interface NowcastData {
  forecast_available?: boolean;
  timesteps: NowcastTimestep[];
  horizon_minutes: number;
}

export interface StormCell {
  cellId: string;
  lat: number;
  lon: number;
  state: string;
  areaKm2: number;
  maxDbz: number;
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  rainRateMmHr: number;
  hailMeshMm: number;
  hailPoshPct: number;
  gustKmph: number;
  lightningRate: number;
  speedKmph: number;
  headingDeg: number;
  direction: string;
  isCloudburst: boolean;
  isSevereHail: boolean;
  isDownburst: boolean;
  movement: { speed_kmh: number; heading_deg: number; direction: string };
  ctcrKPer15min: number;
  ciDetected: boolean;
  history: { t: number; lat: number; lon: number; dbz: number }[];
  countdownTargets?: CountdownTarget[];
}

export interface NationalSummary {
  criticalCells: number;
  highCells: number;
  moderateCells: number;
  totalCells: number;
  citiesUnderWarning: number;
  citiesUnderSevere: number;
  maxDbz: number;
  maxRainMmHr: number;
  totalLightning: number;
  cloudburstCells: number;
  severeHailCells: number;
  ciActiveRegions: string[];
  nationalHazard: HazardLevel;
  monsoonIntensityPct: number;
  lastUpdated: string;
}

export interface WeatherSnapshot {
  timestamp: string;
  tick: number;
  cities: CityWeather[];
  cells: StormCell[];
  summary: NationalSummary;
  sensorMode?: string;
  nowcast?: NowcastData | null;
  activeRegion?: string;
  isLiveSocket?: boolean;
}

// ── deterministic PRNG ────────────────────────────────────────────────────
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── climatology ───────────────────────────────────────────────────────────
const MONTH = new Date().getMonth(); // 0..11

/** Monsoon activity 0..1 for the current month across India. */
const MONTH_MONSOON: Record<number, number> = {
  0: 0.08, 1: 0.1, 2: 0.15, 3: 0.22, 4: 0.35, 5: 0.62,
  6: 0.92, 7: 1.0, 8: 0.85, 9: 0.5, 10: 0.25, 11: 0.1,
};
const BASE_MONSOON = MONTH_MONSOON[MONTH];

/** Peak base temperature by latitude (°C). */
function baseTemp(lat: number): number {
  return clamp(34 - Math.abs(lat - 22) * 0.55, 8, 38);
}

/** Western Ghats orographic multiplier for longitudes in the Ghats corridor. */
function ghatsFactor(lon: number, lat: number): number {
  if (lat < 10 || lat > 22) return 1;
  const ghatsLon = 73.5 + (22 - lat) * 0.28;
  const d = Math.abs(lon - ghatsLon);
  return d < 1.4 ? 1.9 - d * 0.4 : 1;
}

/** Bay of Bengal / NE monsoon moisture for eastern & coastal states. */
function bayMoisture(lon: number, lat: number): number {
  if (lon > 84 && lat > 18 && lat < 28) return 1.45; // Odisha / WB / Assam
  if (lon > 76 && lat > 8 && lat < 16) return 1.2;    // Tamil Nadu east coast
  return 1;
}

const HAZARD_LABEL: Record<HazardLevel, string> = {
  NONE: "No active hazard",
  WATCH: "Monitoring — developing cloud",
  WARNING: "Thunderstorm likely within 1 hour",
  SEVERE: "Heavy rain, lightning, strong gusts",
  EXTREME: "Cloudburst / hail / microburst risk",
};

function hazardFromScore(score: number): HazardLevel {
  if (score >= 82) return "EXTREME";
  if (score >= 62) return "SEVERE";
  if (score >= 40) return "WARNING";
  if (score >= 18) return "WATCH";
  return "NONE";
}

const CARDINALS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
export function cardinal(deg: number): string {
  return CARDINALS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

/** Z-R Marshall-Palmer rain rate from reflectivity (dBZ). */
function zrRainRate(dbz: number): number {
  const z = Math.pow(10, dbz / 10);
  return Math.pow(z / 300, 1 / 1.4);
}

// ── storm cell generation ─────────────────────────────────────────────────
const ACTIVE_CORES: { name: string; lat: number; lon: number; state: string; intensity: number; vx: number; vy: number }[] = [
  { name: "Western Ghats Supercell", lat: 19.6, lon: 73.4, state: "Maharashtra", intensity: 0.95, vx: 0.055, vy: -0.018 },
  { name: "Bay of Bengal Cyclone", lat: 21.4, lon: 87.8, state: "West Bengal", intensity: 0.88, vx: 0.012, vy: -0.06 },
  { name: "Delhi–Haryana Squall Line", lat: 28.9, lon: 76.9, state: "Haryana", intensity: 0.82, vx: 0.04, vy: 0.026 },
  { name: "Karnataka Western Ghats", lat: 14.2, lon: 74.9, state: "Karnataka", intensity: 0.78, vx: 0.03, vy: -0.022 },
  { name: "Brahmaputra Valley Convection", lat: 26.6, lon: 91.4, state: "Assam", intensity: 0.7, vx: 0.018, vy: 0.03 },
  { name: "Rajasthan Isolated Cb", lat: 25.4, lon: 73.4, state: "Rajasthan", intensity: 0.62, vx: 0.06, vy: 0.02 },
  { name: "Chhattisgarh Multicell", lat: 22.4, lon: 81.8, state: "Chhattisgarh", intensity: 0.58, vx: 0.05, vy: -0.014 },
  { name: "Gujarat Coastal Convergence", lat: 22.0, lon: 71.4, state: "Gujarat", intensity: 0.52, vx: -0.03, vy: 0.028 },
  { name: "Tamil Nadu Coastal Squall", lat: 11.4, lon: 79.9, state: "Tamil Nadu", intensity: 0.48, vx: 0.02, vy: 0.012 },
];

export function buildCells(tick: number, now: Date): StormCell[] {
  // The local snapshot refreshes every three seconds; keep simulated storm
  // movement aligned with elapsed time instead of advancing three minutes per tick.
  const minutes = tick * 0.05;
  const hourLocal = now.getHours();

  return ACTIVE_CORES.map((core, i) => {
    /**
     * Position at a given lead time. Storm cores oscillate along their steering
     * vector rather than translating without bound, so the domain stays populated
     * no matter how long the dashboard runs.
     */
    const posAt = (m: number, phase: number) => ({
      lat: clamp(core.lat + core.vy * 26 * Math.sin(m / 95 + phase), 6.5, 36.5),
      lon: clamp(core.lon + core.vx * 26 * Math.sin(m / 95 + phase), 66.0, 96.5),
    });
    const phase = i * 1.31;
    const p = posAt(minutes, phase);
    const lat = p.lat;
    const lon = p.lon;

    // Diurnal convective boost: afternoon peak 14:00–18:00, nocturnal MCS 22:00–03:00
    const diurnal =
      0.78 +
      0.3 * Math.exp(-Math.pow(hourLocal - 16, 2) / 12) +
      0.18 * Math.exp(-Math.pow(hourLocal - 1, 2) / 6);
    const season = 0.55 + BASE_MONSOON * 0.65;
    const intensity = clamp(core.intensity * diurnal * season, 0.12, 1);

    const maxDbz = clamp(22 + intensity * 46 + rnd(i + tick * 0.13) * 5, 20, 68);
    const rainRate = zrRainRate(maxDbz);
    const hailMesh = maxDbz > 48 ? Math.max(0, (maxDbz - 46) * 1.35 * intensity) : 0;
    const posh = hailMesh > 0 ? clamp(Math.min(100, 29 * Math.log(2.54 * Math.sqrt(hailMesh ** 2 / 2.6 + 2.6) + 1)), 0, 100) : 0;
    const gust = clamp(28 + intensity * 52, 25, 105);
    const lightning = clamp(intensity * 62 * rnd(i * 3.1 + tick * 0.07 + 1.7), 0, 90);
    const ctcr = -clamp(intensity * 9 + rnd(i + tick * 0.2) * 2.5, 0, 14);
    const severity: StormCell["severity"] =
      maxDbz >= 58 ? "CRITICAL" : maxDbz >= 50 ? "HIGH" : maxDbz >= 42 ? "MODERATE" : "LOW";

    const speedKmph = clamp(28 + intensity * 32, 20, 78);
    const headingDeg = (core.vx >= 0 ? 95 : 265) + (rnd(i * 5.3) - 0.5) * 40;

    return {
      cellId: `CELL-${String(i + 1).padStart(3, "0")}`,
      lat,
      lon,
      state: core.state,
      areaKm2: clamp(intensity * 240, 12, 420),
      maxDbz: Math.round(maxDbz * 10) / 10,
      severity,
      rainRateMmHr: Math.round(rainRate * 10) / 10,
      hailMeshMm: Math.round(hailMesh * 10) / 10,
      hailPoshPct: Math.round(posh),
      gustKmph: Math.round(gust),
      lightningRate: Math.round(lightning * 10) / 10,
      speedKmph: Math.round(speedKmph),
      headingDeg: Math.round(headingDeg),
      direction: cardinal(headingDeg),
      isCloudburst: rainRate >= 100,
      isSevereHail: hailMesh >= 25,
      isDownburst: maxDbz >= 50 && intensity > 0.6,
      movement: { speed_kmh: Math.round(speedKmph), heading_deg: Math.round(headingDeg), direction: cardinal(headingDeg) },
      ctcrKPer15min: Math.round(ctcr * 10) / 10,
      ciDetected: ctcr <= -4,
      history: Array.from({ length: 10 }, (_, k) => {
        const back = (9 - k) * 6;
        const hp = posAt(minutes - back, phase);
        return {
          t: minutes - back,
          lat: hp.lat,
          lon: hp.lon,
          dbz: Math.round(clamp(22 + (core.intensity * diurnal * season - 0.1) * 46 + rnd(i + k * 1.7) * 6, 18, 70) * 10) / 10,
        };
      }),
    } satisfies StormCell;
  });
}

// ── city weather ──────────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function buildCityWeather(city: City, cells: StormCell[], now: Date): CityWeather {
  const idSeed = hash(city.id);
  const hourLocal = now.getHours() + now.getMinutes() / 60;

  // Diurnal temperature: min ~05:00, max ~15:00
  const diurnal = -Math.cos(((hourLocal - 5) / 24) * 2 * Math.PI);
  let temp = baseTemp(city.lat) + diurnal * 6.5 - 4 + (idSeed - 0.5) * 5;
  if (city.type === "hill") temp -= 11;
  if (city.lon > 80 && city.lat < 16) temp += 2;

  // Storm proximity & local intensity
  let dbz = 12 + rnd(idSeed * 91) * 8;
  let lightning = 0;
  let ctcr = 0;
  let rainMmHr = 0;
  let gust = 6 + rnd(idSeed * 7.1) * 14;
  let nearestKm = 9999;

  for (const c of cells) {
    const d = haversineKm(city.lat, city.lon, c.lat, c.lon);
    nearestKm = Math.min(nearestKm, d);
    const reach = 190 + c.areaKm2 * 1.5;
    if (d < reach) {
      const proximity = 1 - d / reach;
      dbz = Math.max(dbz, c.maxDbz * proximity * (0.7 + 0.4 * proximity));
      lightning += c.lightningRate * proximity;
      ctcr = Math.min(ctcr, c.ctcrKPer15min * proximity);
      rainMmHr += zrRainRate(c.maxDbz * proximity) * proximity;
      gust = Math.max(gust, c.gustKmph * proximity);
    }
  }

  // Orographic + monsoon background rainfall
  const ghats = ghatsFactor(city.lon, city.lat);
  const bay = bayMoisture(city.lon, city.lat);
  const backgroundRain = BASE_MONSOON * ghats * bay * (0.6 + idSeed * 2.4) * (city.type === "hill" ? 1.5 : 1);
  rainMmHr = clamp(rainMmHr + backgroundRain, 0, 210);

  const humidity = clamp(38 + rainMmHr * 2.4 + (idSeed - 0.5) * 26 + (diurnal > 0 ? -6 : 6), 20, 100);
  const reflectivity = clamp(dbz + rainMmHr * 0.28, 8, 68);
  const cloudCover = clamp(rand2(idSeed, now) * 34 + rainMmHr * 1.6 + BASE_MONSOON * 22, 5, 100);
  const pressure = clamp(1013 - rainMmHr * 0.35 - (reflectivity - 30) * 0.22 + (idSeed - 0.5) * 6, 968, 1022);
  const visibility = clamp(20 - rainMmHr * 0.34 + (idSeed - 0.5) * 3, 0.15, 20);
  const windKmph = clamp(gust * 0.42 + 4 + idSeed * 9, 2, 70);
  const windDirDeg = Math.round((hash(city.id + "wd") * 360 + now.getMinutes() * 0.3) % 360);
  const feelsLike = temp + (humidity > 65 ? (humidity - 65) * 0.09 : 0) - windKmph * 0.045;

  const hailMesh = reflectivity >= 50 ? Math.max(0, (reflectivity - 49) * 1.5) : 0;
  const hailPosh = hailMesh > 0 ? clamp(Math.round(29 * Math.log(2.54 * Math.sqrt(hailMesh ** 2 / 2.6 + 2.6) + 1)), 0, 100) : 0;

  // Composite hazard score — the single number the dashboard leads with
  const score = clamp(
    reflectivity * 0.62 + rainMmHr * 0.11 + lightning * 0.34 + Math.max(0, -ctcr) * 1.5 + hailPosh * 0.12 + (gust - 40) * 0.28,
    0,
    100
  );
  const hazard = hazardFromScore(score);

  return {
    cityId: city.id,
    cityName: city.name,
    state: city.state,
    lat: city.lat,
    lon: city.lon,
    temperatureC: Math.round(temp * 10) / 10,
    feelsLikeC: Math.round(feelsLike * 10) / 10,
    humidityPct: Math.round(humidity),
    windKmph: Math.round(windKmph),
    windDirDeg: windDirDeg,
    pressureHpa: Math.round(pressure * 10) / 10,
    visibilityKm: Math.round(visibility * 10) / 10,
    rainMmHr: Math.round(rainMmHr * 10) / 10,
    accumulatedMm: Math.round(rainMmHr * (0.6 + idSeed * 1.4) * 10) / 10,
    cloudCoverPct: Math.round(cloudCover),
    reflectivityDbz: Math.round(reflectivity * 10) / 10,
    hailMeshMm: Math.round(hailMesh * 10) / 10,
    hailPoshPct: hailPosh,
    lightningFlashesKm2: Math.round(lightning * 10) / 10,
    gustKmph: Math.round(gust),
    ctcrKPer15min: Math.round(ctcr * 10) / 10,
    hazard,
    hazardScore: Math.round(score),
    alertHeadline:
      hazard === "EXTREME"
        ? `EXTREME: ${rainMmHr >= 100 ? "cloudburst" : hailMesh >= 25 ? "severe hail" : "violent squall"} risk over ${city.name}`
        : hazard === "SEVERE"
        ? `SEVERE: heavy rain & lightning expected in ${city.name}`
        : hazard === "WARNING"
        ? `WARNING: thunderstorm building near ${city.name}`
        : hazard === "WATCH"
        ? `WATCH: developing cloud within 150 km of ${city.name}`
        : `Clear conditions over ${city.name}`,
    updatedAt: now.toISOString(),
  };
}

function rand2(idSeed: number, now: Date): number {
  return rnd(idSeed * 1000 + Math.floor(now.getTime() / 900000));
}

// ── national roll-up ──────────────────────────────────────────────────────
export function summarize(cities: CityWeather[], cells: StormCell[], now: Date): NationalSummary {
  const criticalCells = cells.filter((c) => c.severity === "CRITICAL").length;
  const highCells = cells.filter((c) => c.severity === "HIGH").length;
  const moderateCells = cells.filter((c) => c.severity === "MODERATE").length;
  const maxDbz = cells.length ? Math.max(...cells.map((c) => c.maxDbz)) : 0;
  const maxRain = cells.length ? Math.max(...cells.map((c) => c.rainRateMmHr)) : 0;

  const warnings = cities.filter((c) => c.hazard === "WARNING").length;
  const severe = cities.filter((c) => c.hazard === "SEVERE" || c.hazard === "EXTREME").length;
  const ciActive = [...new Set(cells.filter((c) => c.ciDetected).map((c) => c.state))];

  const nationalHazard = hazardFromScore(
    clamp(maxDbz * 0.72 + maxRain * 0.1 + severe * 6 + criticalCells * 10, 0, 100)
  );

  return {
    criticalCells,
    highCells,
    moderateCells,
    totalCells: cells.length,
    citiesUnderWarning: warnings,
    citiesUnderSevere: severe,
    maxDbz: Math.round(maxDbz * 10) / 10,
    maxRainMmHr: Math.round(maxRain * 10) / 10,
    totalLightning: Math.round(cells.reduce((s, c) => s + c.lightningRate, 0)),
    cloudburstCells: cells.filter((c) => c.isCloudburst).length,
    severeHailCells: cells.filter((c) => c.isSevereHail).length,
    ciActiveRegions: ciActive,
    nationalHazard,
    monsoonIntensityPct: Math.round(BASE_MONSOON * 100),
    lastUpdated: now.toISOString(),
  };
}

let tickCounter = 0;
export function getSnapshot(): WeatherSnapshot {
  const now = new Date();
  tickCounter += 1;
  const cells = buildCells(tickCounter, now);
  const cities = ALL_CITIES.map((c) => buildCityWeather(c, cells, now));
  const summary = summarize(cities, cells, now);

  const nowcast: NowcastData = {
    forecast_available: true,
    horizon_minutes: 360,
    timesteps: [
      { lead_time_min: 0, predicted_max_dbz: summary.maxDbz, predicted_max_rain_rate_mm_hr: summary.maxRainMmHr, predicted_lightning_activity: summary.totalLightning, predicted_peak_gust_kmh: 45 },
      { lead_time_min: 30, predicted_max_dbz: Math.min(75, Math.round(summary.maxDbz * 1.04)), predicted_max_rain_rate_mm_hr: Math.round(summary.maxRainMmHr * 1.08), predicted_lightning_activity: Math.round(summary.totalLightning * 1.08), predicted_peak_gust_kmh: 52 },
      { lead_time_min: 60, predicted_max_dbz: Math.min(75, Math.round(summary.maxDbz * 1.06)), predicted_max_rain_rate_mm_hr: Math.round(summary.maxRainMmHr * 1.12), predicted_lightning_activity: Math.round(summary.totalLightning * 1.12), predicted_peak_gust_kmh: 58 },
      { lead_time_min: 120, predicted_max_dbz: Math.max(20, Math.round(summary.maxDbz * 0.98)), predicted_max_rain_rate_mm_hr: Math.round(summary.maxRainMmHr * 1.02), predicted_lightning_activity: Math.round(summary.totalLightning * 0.95), predicted_peak_gust_kmh: 50 },
      { lead_time_min: 180, predicted_max_dbz: Math.max(20, Math.round(summary.maxDbz * 0.92)), predicted_max_rain_rate_mm_hr: Math.round(summary.maxRainMmHr * 0.88), predicted_lightning_activity: Math.round(summary.totalLightning * 0.82), predicted_peak_gust_kmh: 44 },
      { lead_time_min: 240, predicted_max_dbz: Math.max(20, Math.round(summary.maxDbz * 0.84)), predicted_max_rain_rate_mm_hr: Math.round(summary.maxRainMmHr * 0.76), predicted_lightning_activity: Math.round(summary.totalLightning * 0.68), predicted_peak_gust_kmh: 38 },
      { lead_time_min: 300, predicted_max_dbz: Math.max(20, Math.round(summary.maxDbz * 0.76)), predicted_max_rain_rate_mm_hr: Math.round(summary.maxRainMmHr * 0.64), predicted_lightning_activity: Math.round(summary.totalLightning * 0.55), predicted_peak_gust_kmh: 32 },
      { lead_time_min: 360, predicted_max_dbz: Math.max(20, Math.round(summary.maxDbz * 0.65)), predicted_max_rain_rate_mm_hr: Math.round(summary.maxRainMmHr * 0.50), predicted_lightning_activity: Math.round(summary.totalLightning * 0.42), predicted_peak_gust_kmh: 28 },
    ],
  };

  return {
    timestamp: now.toISOString(),
    tick: tickCounter,
    cities,
    cells,
    summary,
    nowcast,
  };
}

// ── derived helpers used by the UI ────────────────────────────────────────
export function citiesOfState(region: StateRegion): City[] {
  return region.cities;
}

export function stateOfCity(cityName: string): string {
  return ALL_CITIES.find((c) => c.name === cityName)?.state ?? "";
}

/** CSS class suffix per hazard level — keeps severity colour mapping in one place. */
export const HAZ_CLASS: Record<HazardLevel, string> = {
  NONE: "sev-none",
  WATCH: "sev-watch",
  WARNING: "sev-warning",
  SEVERE: "sev-severe",
  EXTREME: "sev-extreme",
};

export { HAZARD_LABEL, INDIA_REGIONS, zrRainRate };
