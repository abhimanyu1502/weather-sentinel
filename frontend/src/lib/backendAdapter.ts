/**
 * backendAdapter.ts — Normalization adapter bridging backend FastAPI / WebSocket
 * contracts with frontend StormSentinel data types.
 *
 * Solves PRD Gap F2 (contract mismatch), F1 (live feed merging), F6 (countdown targets),
 * and F5 (ConvLSTM nowcast horizon).
 */

import { ALL_CITIES } from "../data/indiaGeo";
import {
  CityWeather,
  CountdownTarget,
  HazardLevel,
  NationalSummary,
  NowcastData,
  StormCell,
  WeatherSnapshot,
  buildCityWeather,
  summarize,
} from "./weatherEngine";

export interface BackendMovement {
  speed_kmh: number;
  heading_deg: number;
  direction: string;
}

export interface BackendActiveCell {
  cell_id: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | string;
  lat: number;
  lon: number;
  area_km2: number;
  max_dbz: number;
  hail_mesh_mm: number;
  hail_posh_pct: number;
  rain_rate_mm_hr: number;
  downburst_gust_kmh: number;
  is_cloudburst: boolean;
  is_severe_hail: boolean;
  is_downburst: boolean;
  lightning_intensity: number;
  movement: BackendMovement;
  countdown_targets?: CountdownTarget[];
}

export interface BackendConvectiveInitiation {
  detected: boolean;
  confidence: number;
  triggers: string[];
  ctcr_k_per_15min: number;
  min_tir1_k: number;
  min_swd_k: number;
}

export interface BackendDomainSummary {
  max_reflectivity_dbz: number;
  max_rain_rate_mm_hr: number;
  total_lightning_strokes: number;
  active_storm_cells: number;
  cloudburst_cells: number;
  severe_hail_cells: number;
}

export interface BackendStatePayload {
  timestamp: string;
  simulation_timestep: number;
  region_id: string;
  sensor_mode: "RADAR_FUSED" | "SATELLITE_FALLBACK" | string;
  convective_initiation: BackendConvectiveInitiation;
  domain_summary: BackendDomainSummary;
  active_storm_cells: BackendActiveCell[];
  nowcast?: NowcastData | null;
  nowcast_available?: boolean;
}

// ── Persistent cell track history cache ───────────────────────────────────
interface HistoryPoint {
  t: number;
  lat: number;
  lon: number;
  dbz: number;
}

const cellHistoryCache = new Map<string, HistoryPoint[]>();
const MAX_HISTORY_POINTS = 9;

/** Find nearest state name for a given (lat, lon) coordinate */
function findNearestState(lat: number, lon: number): string {
  let nearestDist = Infinity;
  let nearestState = "India";
  for (const c of ALL_CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (d < nearestDist) {
      nearestDist = d;
      nearestState = c.state;
    }
  }
  return nearestState;
}

/**
 * Normalizes a live backend WebSocket payload into a full frontend WeatherSnapshot,
 * updating city proximity weather and cell kinematics.
 */
export function normalizeBackendPayload(
  payload: BackendStatePayload,
  previousSnapshot?: WeatherSnapshot
): WeatherSnapshot {
  const now = new Date(payload.timestamp || new Date().toISOString());
  const tick = payload.simulation_timestep ?? (previousSnapshot?.tick ? previousSnapshot.tick + 1 : 1);

  // Normalize server storm cells
  const normalizedCells: StormCell[] = (payload.active_storm_cells || []).map((c) => {
    const cellId = c.cell_id;
    const history = cellHistoryCache.get(cellId) || [];

    // Append new point
    const currentPoint: HistoryPoint = {
      t: tick,
      lat: c.lat,
      lon: c.lon,
      dbz: c.max_dbz,
    };

    let updatedHistory: HistoryPoint[];
    if (history.length === 0) {
      // Synthesize past 3 points along the reverse movement heading if new
      const speed = c.movement?.speed_kmh || 25;
      const headingRad = ((c.movement?.heading_deg || 90) * Math.PI) / 180;
      const revHeading = headingRad + Math.PI;
      const synth: HistoryPoint[] = [];

      for (let k = 3; k >= 1; k--) {
        const dtHours = (k * 10) / 60;
        const distKm = speed * dtHours;
        const dLat = (distKm * Math.cos(revHeading)) / 111;
        const dLon = (distKm * Math.sin(revHeading)) / (111 * Math.cos((c.lat * Math.PI) / 180));
        synth.push({
          t: tick - k * 3,
          lat: c.lat + dLat,
          lon: c.lon + dLon,
          dbz: Math.max(25, c.max_dbz - k * 2.5),
        });
      }
      updatedHistory = [...synth, currentPoint];
    } else {
      updatedHistory = [...history, currentPoint];
      if (updatedHistory.length > MAX_HISTORY_POINTS) {
        updatedHistory = updatedHistory.slice(updatedHistory.length - MAX_HISTORY_POINTS);
      }
    }
    cellHistoryCache.set(cellId, updatedHistory);

    const severityMap: Record<string, "LOW" | "MODERATE" | "HIGH" | "CRITICAL"> = {
      CRITICAL: "CRITICAL",
      HIGH: "HIGH",
      MODERATE: "MODERATE",
      LOW: "LOW",
    };
    const sev = severityMap[c.severity?.toUpperCase()] || "MODERATE";

    return {
      cellId: c.cell_id,
      lat: c.lat,
      lon: c.lon,
      state: findNearestState(c.lat, c.lon),
      areaKm2: c.area_km2,
      maxDbz: c.max_dbz,
      severity: sev,
      rainRateMmHr: c.rain_rate_mm_hr,
      hailMeshMm: c.hail_mesh_mm,
      hailPoshPct: c.hail_posh_pct,
      gustKmph: c.downburst_gust_kmh,
      lightningRate: c.lightning_intensity,
      speedKmph: c.movement?.speed_kmh ?? 20,
      headingDeg: c.movement?.heading_deg ?? 90,
      direction: c.movement?.direction ?? "E",
      isCloudburst: c.is_cloudburst ?? false,
      isSevereHail: c.is_severe_hail ?? false,
      isDownburst: c.is_downburst ?? false,
      movement: c.movement ?? { speed_kmh: 20, heading_deg: 90, direction: "E" },
      ctcrKPer15min: payload.convective_initiation?.ctcr_k_per_15min ?? -1.0,
      ciDetected: payload.convective_initiation?.detected ?? false,
      history: updatedHistory,
      countdownTargets: c.countdown_targets || [],
    };
  });

  // Clean stale cell caches
  const activeIds = new Set(normalizedCells.map((c) => c.cellId));
  for (const id of cellHistoryCache.keys()) {
    if (!activeIds.has(id)) {
      cellHistoryCache.delete(id);
    }
  }

  // Build city weather based on live server cells
  const cities = ALL_CITIES.map((c) => buildCityWeather(c, normalizedCells, now));

  // Build summary and merge domain specifics
  const baseSummary = summarize(cities, normalizedCells, now);
  const summary: NationalSummary = {
    ...baseSummary,
    maxDbz: payload.domain_summary?.max_reflectivity_dbz ?? baseSummary.maxDbz,
    maxRainMmHr: payload.domain_summary?.max_rain_rate_mm_hr ?? baseSummary.maxRainMmHr,
    totalLightning: payload.domain_summary?.total_lightning_strokes ?? baseSummary.totalLightning,
    cloudburstCells: payload.domain_summary?.cloudburst_cells ?? baseSummary.cloudburstCells,
    severeHailCells: payload.domain_summary?.severe_hail_cells ?? baseSummary.severeHailCells,
    lastUpdated: payload.timestamp || now.toISOString(),
  };

  return {
    timestamp: payload.timestamp || now.toISOString(),
    tick,
    cities,
    cells: normalizedCells,
    summary,
    sensorMode: payload.sensor_mode || "RADAR_FUSED",
    nowcast: payload.nowcast || null,
    activeRegion: payload.region_id || "ALL_INDIA",
    isLiveSocket: true,
  };
}
