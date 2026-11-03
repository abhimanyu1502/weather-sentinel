export interface CountdownTarget {
  target_name: string;
  lat: number;
  lon: number;
  distance_km: number;
  eta_seconds: number;
  hazard_level: "RED_ALERT" | "ORANGE_ALERT" | "YELLOW_ALERT" | string;
  category: string;
}

export interface Movement {
  speed_kmh: number;
  heading_deg: number;
  direction: string;
}

export interface StormCell {
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
  movement: Movement;
  countdown_targets: CountdownTarget[];
}

export interface ConvectiveInitiation {
  detected: boolean;
  confidence: number;
  triggers: string[];
  ctcr_k_per_15min: number;
  min_tir1_k: number;
  min_swd_k: number;
}

export interface DomainSummary {
  max_reflectivity_dbz: number;
  max_rain_rate_mm_hr: number;
  total_lightning_strokes: number;
  active_storm_cells: number;
  cloudburst_cells: number;
  severe_hail_cells: number;
}

export interface NowcastTimestep {
  lead_time_min: number;
  predicted_max_dbz: number;
  predicted_max_rain_rate_mm_hr: number;
  predicted_lightning_activity: number;
  predicted_peak_gust_kmh: number;
}

export interface NowcastData {
  forecast_available: boolean;
  timesteps: NowcastTimestep[];
  horizon_minutes: number;
}

export interface HazardState {
  timestamp: string;
  simulation_timestep: number;
  sensor_mode: "RADAR_FUSED" | "SATELLITE_FALLBACK" | string;
  convective_initiation: ConvectiveInitiation;
  domain_summary: DomainSummary;
  active_storm_cells: StormCell[];
  nowcast?: NowcastData | null;
  nowcast_available?: boolean;
}

export interface AIAdvisoryData {
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
