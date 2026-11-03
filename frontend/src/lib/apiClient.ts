/**
 * apiClient.ts — Client service communicating with StormSentinel FastAPI backend.
 *
 * Handles sensor health, failover control, landmarks, AI meteorological advisory,
 * historical events, and Common Alerting Protocol (CAP-CP v1.2) XML feeds.
 */

export interface SensorHealth {
  dwr_network: "OPERATIONAL" | "DEGRADED" | "OFFLINE" | string;
  insat_imager: "OPERATIONAL" | "DEGRADED" | "OFFLINE" | string;
  damini_lightning: "OPERATIONAL" | "DEGRADED" | "OFFLINE" | string;
  aws_stations: "OPERATIONAL" | "DEGRADED" | "OFFLINE" | string;
}

export interface DashboardSummaryResponse {
  timestamp: string;
  total_active_cells: number;
  national_max_dbz: number;
  national_max_rain_rate: number;
  total_lightning_strokes: number;
  cloudburst_threat_cells: number;
  regions_monitored: number;
  sensor_health: SensorHealth;
}

export interface FailoverResponse {
  radar_offline_mode: boolean;
  mode: string;
}

export interface LandmarkItem {
  name: string;
  lat: number;
  lon: number;
  category: "Airport" | "Railway" | "Commercial" | "Urban" | "Hill Station" | string;
  region: string;
  alert_radius_km: number;
}

export interface HistoricalEventItem {
  event_id: string;
  title: string;
  date: string;
  peak_rain_mm_hr?: number;
  total_24h_mm?: number;
  peak_gust_kmh?: number;
  synopsis: string;
}

export interface AIAdvisoryResponse {
  source: string;
  urgency?: string;
  diagnosis?: string;
  threat_matrix?: {
    flash_flood_risk: string;
    microburst_risk: string;
    severe_hail_risk: string;
    lightning_hazard: string;
  };
  tactical_directives?: string[];
  advisory?: string;
}

export interface CapAlertData {
  alertId: string;
  headline: string;
  description: string;
  instruction: string;
  severity: string;
  urgency: string;
  certainty: string;
  event: string;
  sent: string;
  rawXml: string;
}

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000/api";

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/dashboard/summary`, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function toggleFailover(radarOffline?: boolean): Promise<FailoverResponse | null> {
  try {
    const url = radarOffline !== undefined
      ? `${API_BASE}/failover?radar_offline=${radarOffline}`
      : `${API_BASE}/failover`;
    const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLandmarks(region?: string): Promise<LandmarkItem[]> {
  try {
    const url = region && region !== "ALL_INDIA" ? `${API_BASE}/landmarks?region=${region}` : `${API_BASE}/landmarks`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.landmarks || [];
  } catch {
    return [];
  }
}

export async function fetchHistoricalEvents(regionId: string = "WEST_INDIA"): Promise<HistoricalEventItem[]> {
  try {
    const res = await fetch(`${API_BASE}/regions/${regionId}/historical-events`, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

export async function fetchAiAdvisory(): Promise<AIAdvisoryResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/ai-advisory`, { method: "POST", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchCapAlert(): Promise<CapAlertData | null> {
  try {
    const res = await fetch(`${API_BASE}/alerts/cap`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const xmlText = await res.text();

    // Parse XML in browser
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const alertId = doc.querySelector("identifier")?.textContent || "CAP-ALERT";
    const headline = doc.querySelector("headline")?.textContent || "Severe Convective Warning";
    const description = doc.querySelector("description")?.textContent || "";
    const instruction = doc.querySelector("instruction")?.textContent || "";
    const severity = doc.querySelector("severity")?.textContent || "Severe";
    const urgency = doc.querySelector("urgency")?.textContent || "Immediate";
    const certainty = doc.querySelector("certainty")?.textContent || "Observed";
    const event = doc.querySelector("event")?.textContent || "Severe Thunderstorm";
    const sent = doc.querySelector("sent")?.textContent || new Date().toISOString();

    return {
      alertId,
      headline,
      description,
      instruction,
      severity,
      urgency,
      certainty,
      event,
      sent,
      rawXml: xmlText,
    };
  } catch {
    return null;
  }
}
