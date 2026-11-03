# StormSentinel — Full-Project PRD, Gap Analysis & Integration Plan

> Generated: 2026-10-03 · Scope: pan-India convective-scale nowcasting platform (0–6 h lead, 1–3 km resolution)
> Status: **Frontend MVP live** (deterministic simulation, corrected India boundary) · **Backend skeleton live** (FastAPI + synthetic pipeline)

---

## 1. Research context — why this system must exist

### 1.1 The problem (verified against the codebase's own domain model)

Convective storms — severe thunderstorms, hail, downbursts, cloudbursts — are among India's deadliest hazards, concentrated in the pre-monsoon (Mar–May) and monsoon (Jun–Sep) seasons. The frontend's hazard model already encodes the right physics vocabulary:

| Index | Frontend implementation (`weatherEngine.ts`) | Operational meaning |
|---|---|---|
| **CTCR** | cloud-top cooling rate, K/15 min; CI flag at ≤ −4 | Rapid overshooting-top cooling = convective initiation signature |
| **MESH** | derived from dBZ > 49 (`(dBZ−49)×1.5`) | Maximum expected hail diameter (mm) |
| **POSH** | `29·log(2.54·√(MESH²/2.6+2.6)+1)` | Probability of severe hail (%) |
| **Z-R rain** | Marshall–Palmer `R=(Z/300)^(1/1.4)` | dBZ → rain rate (mm/h) |
| **Gust / downburst** | gust ≥ 55 km/h flags microburst | ΔV divergence ≥ 25 m/s across 45+ dBZ core |
| **Cloudburst** | rain ≥ 100 mm/h | IMD cloudburst threshold |

### 1.2 Why NWP fails here (the PRD's core premise, correct)

- **Scale**: convective cells are 2–30 km and develop in 5–30 min. India's operational GFS/WRF runs at 9–12 km grid spacing — a single grid cell can contain an entire storm生命周期; initiation is sub-grid.
- **Latency**: even a 1 km WRF run takes 30–90 min wall-clock to produce a 6 h forecast — useless when the storm arrives in 20.
- **Hence the architecture**: **multi-source data fusion + radar-image extrapolation + ML nowcasting**, exactly what the backend pipeline (`ingestion → fusion/grid_aligner → features/physics_features → tracking/cell_tracker → models/inference_service`) is scaffolded for.

### 1.3 Reference systems & data sources (India-specific)

| Source | Product | Cadence / Res | Access |
|---|---|---|---|
| **IMD Doppler Weather Radars (DWR)** — 12+ radars (Delhi, Mumbai, Chennai, Kolkata, Guwahati, Nagpur, Jaipur, Patiala, Bhuj, Vishakhapatnam, Port Blair, Srinagar) | reflectivity, velocity, dual-pol (ZDR, KDP) composites | 10 min / 0.25–1 km | MOSDAC (`mosdac.gov.in`), IMD Mausam API; ODIM-H5/NetCDF |
| **INSAT-3D/3DR** imager | TIR (cloud-top temp), water vapour, visible | 15 min / 8 km (visible 1 km) | MOSDAC INSAT archive + near-real-time feeds |
| **Lightning** — IMD **DAMINI** (LLS), LINET, GLD360 | stroke location, multiplicity, peak current | ms latency, ~5 km | IMD Damini API / LINET data feed |
| **AWS / SYNOP / Meghdoot** | surface obs (temp, RH, wind, MSLP) | 1 h / station | IMD Meghdoot API (`mausam.imd.gov.in`) |
| **IMD Nowcast / Warn** | 0–2 h thunderstorm/heavy-rain warnings | hourly | IMD Mausam |
| **NWP context** — GFS, WRF, HRRR-like | CAPE, shear, PWAT, steering flow | 6 h / 9–25 km | NOAA NOMADS, IMD MUSAC |

Comparable production systems: NOAA HRRR, MRMS (NSSL), Met Office Nimrod nowcast, DWD RadarPRO. India's own efforts: IMD's Nowcast (2017+), IITM's SAARC/WRF, and the ISRO-MOSDAC "Satellite & Radar based nowcast".

### 1.4 What "1–3 km, 0–6 h" actually demands

- **Grid**: national 1 km grid = ~2,900 × 3,200 ≈ **9.3 M cells**. Feasible on one GPU for inference, heavy for fusion. Pragmatic: **8–10 regional 3 km tiles** (e.g., W-India, N-Plains, NE-Hills, Peninsula… each ~512×512) — matches the backend's existing `PAN_INDIA_REGIONS` 6-region split, but the current `GRID_H/W = 128` over the *whole country* is ~**22 km cells** — 7–20× too coarse for the PRD's stated resolution. This is the single biggest backend gap.

---

## 2. Frontend audit — what exists vs what's missing

### 2.1 Verified as working (read in code, build passes, pixel-tested)

- `indiaGeo.ts` — 36 S/UT, 152 cities, 7 macro-zones; **India boundary now correct** (see §4)
- `weatherEngine.ts` — deterministic PRNG, monsoon seasonality, diurnal cycle, Ghats orography, Bay moisture, Z-R, MESH/POSH/CTCR, hazard score
- `Map2D.tsx` — MapLibre dark tactical basemap, landmass fill + glowing national border, state/UT borders + labels, hazard dots (5-level ramp), storm-cell markers with pulse, impact-countdown rings, track polylines, zoom-aware collision-avoiding labels, viewport culling
- `TopBar.tsx` — Ctrl+K fuzzy search (city/state/zone), national hazard banner, live/hold, IST clock
- `LeftRail.tsx` — zone switcher, state→city tree with live badges, 7 layer toggles
- `CityDetailPanel.tsx` — Conditions / Hazard Indices (trigger checklist vs IMD thresholds) / Nearby (350 km)
- `DashboardGrid.tsx` — 8 KPIs, active alerts, cell register, 0–120 min horizon, state roll-up, rainfall leaders, risk distribution
- `StormCellDrawer.tsx` — cell anomaly drawer: stats, 54-min intensity history, downstream metro ETAs, steering, footprint, CI flag
- Responsive: compact/slide-over rails ≤1040 px

### 2.2 Missing in the frontend (integration gaps vs the real backend)

| # | Gap | Impact | Effort |
|---|---|---|---|
| F1 | **No live socket connection.** `useLiveWeatherSocket` exists only in `src/_legacy/`; the app runs purely on `getSnapshot()`. The backend broadcasts at `ws://localhost:8000/ws/live-stream` but is never contacted. | Dashboard is a demo, not a nowcast system | M |
| F2 | **Payload contract mismatch.** Backend `active_storm_cells[]` fields: `cell_id, severity, lat, lon, area_km2, max_dbz, hail_mesh_mm, hail_posh_pct, rain_rate_mm_hr, downburst_gust_kmh, is_cloudburst, is_severe_hail, is_downburst, lightning_intensity, movement{speed_kmh,heading_deg,direction}, countdown_targets[]`, plus `convective_initiation{...}`, `domain_summary{...}`, `nowcast`. Frontend `StormCell` uses different names (`cellId, maxDbz, rainRateMmHr, gustKmph, lightningRate, speedKmph, headingDeg, ctcrKPer15min, ciDetected, history[]`). | Needs a **normalization adapter** (`lib/backendAdapter.ts`) before any live wiring | M |
| F3 | **"Infrared Satellite" layer is fake** — only changes heatmap opacity; no INSAT TIR raster overlay. | Missing sensor; PRD's INSAT-3DR stream unused | L (needs WMTS/XYZ raster source or COG tiles from backend) |
| F4 | **No real reflectivity field.** `ag-pts` is circles at city/cell points, not a dBZ grid. | Radar composite invisible | L (backend must serve gridded dBZ as XYZ/COG tiles) |
| F5 | **0–120 min horizon is a synthetic decay curve**, not the ConvLSTM `nowcast` payload from the backend. | Nowcast panel decorative | M |
| F6 | **Backend `countdown_targets` ignored** — frontend recomputes ETAs from distance/speed. | Duplicate logic; misses landmark-aware ETAs | S |
| F7 | **No region mapping** — backend streams 6 radar regions + ALL_INDIA; frontend has 7 macro-zones; no mapping layer. | Region switch wouldn't subscribe correctly | S |
| F8 | **No sensor-health panel** — backend `/api/dashboard/summary` exposes `sensor_health{dwr_network, insat_imager, damini_lightning, aws_stations}`; unused. | Operators can't see data freshness | S |
| F9 | **No failover control** — backend `POST /api/failover` (RADAR_FUSED ↔ SATELLITE_FALLBACK) unused. | Can't demo satellite-only mode | S |
| F10 | **No landmarks layer** — backend `LANDMARKS` (airports, railways, commercial hubs + alert radii) unused; PRD explicitly serves aviation & local admin. | Key use-case invisible | S |
| F11 | **No AI advisory panel** — `POST /api/ai-advisory` unused (modal sits in `_legacy/AIAdvisoryModal.tsx`). | Narrative guidance missing | S |
| F12 | **No CAP alert consumption** — backend `GET /api/alerts/cap` (OASIS CAP v1.2 XML) unused; no alert history, no browser/push notifications. | No end-to-end warning chain | M |
| F13 | **No historical events view** — backend `HISTORICAL_EVENTS` (2005 Mumbai, 2013 Kedarnath, 2018 Nor'wester) unused. | Context/education lost | S |
| F14 | **No time-series archive** — no 24 h rain/dBZ charts, no persistence of past ticks (state is ephemeral). | Trend analysis impossible | M (needs DB read API) |
| F15 | **No legend panel** — hazard ramp is only implied by the distribution histogram; no explicit colour/shape legend. | Usability gap | S |
| F16 | **No error/empty/offline states** — no connection-lost UI, skeletons, or error boundary; if the WS dies, the UI silently freezes. | Robustness gap | S |
| F17 | **No units/i18n** — °C/°F, km/h–mph toggles absent; IMD warnings should reach Hindi/Bengali/Tamil etc. for field admins. | Accessibility/scale | M |
| F18 | **Perf: full marker DOM rebuild every 3 s tick** (152+ city markers + cells). Works, but GC churn; better as a single GeoJSON source `setData`. | Long-session stability | M |
| F19 | **District-level granularity absent** — PRD demands hyper-local 1–3 km; frontend has 152 city points only. | Coverage gap vs PRD | L (needs district GeoJSON + grid tile display) |
| F20 | `StormCellDrawer` hardcodes 8 metros for ETA; should derive from backend `countdown_targets` or the landmarks list. | Scalability | S |

---

## 3. Backend & database requirements (full project)

### 3.1 What exists (verified in `backend/`, `pipelines/`, `models/`)

- FastAPI app with lifespan-driven nowcast loop (3 s broadcast), CORS, multi-region WS manager (`/ws/live-stream`, `/ws/regions/{id}`)
- `SyntheticStormGenerator` — 5-channel scenes (dBZ, TIR1, TIR2, velocity, lightning) over 6 regional domains
- `GridAligner` — 5-channel tensor alignment
- `detect_ci` — CTCR-based convective initiation detection
- `StormCellTracker` — segmentation (≥38 dBZ, ≥12 km²), Hungarian-style tracking, landmark countdowns
- `compute_storm_params` — Z-R rain, MESH, POSH, downburst gust, severity levels
- `NowcastInferenceService` — ConvLSTM checkpoint inference
- REST: `/api/health`, `/regions`, `/landmarks`, `/current-hazards`, `/dashboard/summary`, `/reset`, `/failover`, `/ai-advisory`, `/alerts/cap`
- CAP v1.2 XML generator; `scripts/init_db.sql` (PostGIS schema — **not connected to anything**)

### 3.2 What the backend still needs

| # | Requirement | Detail |
|---|---|---|
| B1 | **Real ingestion adapters** (replace/augment synthetic generator) | DWR (MOSDAC/IMD, ODIM-H5 → dBZ/velocity grids), INSAT-3DR (TIR/WV), DAMINI lightning strokes, AWS/SYNOP surface obs. Each adapter: poller → normalizer → quality flags → `SensorHealth` status. |
| B2 | **3 km regional grids** | Replace national 128×128 (~22 km) with 8–10 regional tiles (≥512×512 at 3 km) + a national 6–9 km overview mosaic. Keep the 5-channel schema. |
| B3 | **TimescaleDB + PostGIS** (primary store) | Hypertables: `storm_cells` (retention 90 d), `cell_tracks` (LineString, per-cell history), `lightning_strokes` (raw, 30 d) + `lightning_density_5min`, `radar_frames` (metadata + COG path), `satellite_frames`, `surface_obs`, `alerts_cap`, `forecast_runs` (nowcast model runs + metrics). Existing `init_db.sql` is the seed — extend with `timescaledb` extension, compression, continuous aggregates (5-min cell counts, hourly max dBZ per state). |
| B4 | **Redis** | WS pub/sub fan-out (replace in-memory manager), latest-state cache (TTL 30 s) for REST, rate-limit counters, connection registry, reconnection `last-event-id` replay. |
| B5 | **Object storage** (S3/MinIO) | Raw DWR/INSAT files, dBZ/INSAT COG tiles for the map, model checkpoints, CAP archive. |
| B6 | **Alerting engine** | Configurable threshold rules per district/landmark (cloudburst ≥100 mm/h, MESH ≥25 mm, gust ≥55 km/h, CTCR ≤−4), dedup + cooldown, escalation ladder, multi-channel emit: CAP XML, SMS (DLT), push, email, webhook. |
| B7 | **Nowcast model serving** | Model registry + versioning, GPU/ONNX runtime options, batch fallback, input validation, drift/quality metrics to `forecast_runs`. |
| B8 | **Auth & governance** | API keys, per-tier rate limits, close CORS origins, data-use audit log (IMD data is free for research; commercial use needs MOU). |
| B9 | **Observability** | Prometheus metrics (ingest lag, source freshness, WS connections, inference latency), structured logs, per-source health in `/dashboard/summary`, SLA alerts when a feed is stale >15 min. |
| B10 | **Deployment** | Docker Compose (api, worker, timescale, redis, minIO), k8s manifests, CI (pytest + `tests/validation/run_all_checks.py`), env-driven config (`config/settings.py` already has the right knobs). |
| B11 | **National cell tracking** | Track cells across region borders (currently per-region), with national cell IDs stable across tiles. |
| B12 | **Map tile service** | Serve dBZ composite, INSAT TIR, lightning density, and nowcast frames as XYZ/COG tiles (e.g., `/tiles/{layer}/{z}/{x}/{y}.png` + COG for high-res) so F3/F4 become real layers. |

### 3.3 Database schema (target, extends `scripts/init_db.sql`)

```sql
-- TimescaleDB + PostGIS
CREATE EXTENSION IF NOT EXISTS timescaledb, postgis;

CREATE TABLE storm_cells (           -- hypertable, 90-day retention
  cell_id        TEXT NOT NULL,      -- e.g. CELL-0001 (stable across region hops)
  observed_at    TIMESTAMPTZ NOT NULL,
  region_id      TEXT,
  centroid       GEOMETRY(Point,4326),
  area_km2       FLOAT,  max_dbz FLOAT,  severity TEXT,
  rain_rate_mm_hr FLOAT, hail_mesh_mm FLOAT, hail_posh_pct FLOAT,
  downburst_gust_kmh FLOAT, lightning_intensity FLOAT,
  is_cloudburst BOOLEAN, is_severe_hail BOOLEAN, is_downburst BOOLEAN,
  steering       JSONB               -- {speed_kmh, heading_deg, direction}
);
SELECT create_hypertable('storm_cells','observed_at');

CREATE TABLE cell_tracks (           -- per-cell trajectory segments
  cell_id TEXT, observed_at TIMESTAMPTZ,
  track GEOMETRY(LineString,4326),  -- 10-min segments
  max_dbz FLOAT, severity TEXT
);

CREATE TABLE lightning_strokes (     -- raw feed, 30-day retention
  stroke_id BIGINT, observed_at TIMESTAMPTZ,
  loc GEOMETRY(Point,4326), peak_current_ka FLOAT, multiplicity INT,
  network TEXT                      -- DAMINI | LINET | GLD360
);

CREATE TABLE satellite_frames (      -- INSAT-3DR imagery metadata
  frame_id TEXT, observed_at TIMESTAMPTZ, band TEXT,  -- TIR | WV | VIS
  cloud_top_temp_k FLOAT, cog_url TEXT, s3_key TEXT
);

CREATE TABLE radar_frames (          -- DWR volume metadata
  radar_id TEXT, observed_at TIMESTAMPTZ,
  product TEXT,                     -- REFLECTIVITY | VELOCITY | ZDR | KDP
  tilts JSONB, cog_url TEXT
);

CREATE TABLE surface_obs (           -- AWS/SYNOP
  station_id TEXT, observed_at TIMESTAMPTZ,
  loc GEOMETRY(Point,4326), temp_c FLOAT, rh_pct FLOAT,
  wind_kmh FLOAT, wind_dir INT, mslp_hpa FLOAT, rain_mm_hr FLOAT
);

CREATE TABLE alerts_cap (            -- issued warnings
  alert_id TEXT PRIMARY KEY, issued_at TIMESTAMPTZ,
  severity TEXT, event TEXT, area GEOMETRY(Polygon,4326),
  cap_xml TEXT, channels TEXT[], consumed_by INT DEFAULT 0
);

CREATE TABLE forecast_runs (         -- nowcast model runs
  run_id TEXT, started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ,
  model_version TEXT, lead_minutes INT, region_id TEXT,
  metrics JSONB                     -- MAE, CSI, FSS vs verification
);
```

---

## 4. Changes made this session — India map corrected to official Survey of India reference

**Problem:** Previously, the boundary dataset was truncated at latitude 35.501° N (cutting off the northern crown of Jammu & Kashmir and Ladakh — including Gilgit, Baltistan, Siachen, and Aksai Chin), and third-party Carto basemap boundary lines showed conflicting disputed borders.

**Fix (aligned exactly with official Survey of India political map):**

1. **`stormsentinel/data/geo/india_states_soi.geojson` & `tools/build_india_geo.py`**:
   - Acquired and cached the full official Survey of India state boundary dataset (DataMeet / SOI official political map), spanning `[68.186, 6.756, 97.415, 37.078]`.
   - Correctly includes all 36 States & Union Territories: complete Jammu & Kashmir / Ladakh extending up to 37.08° N (Indira Col), Arunachal Pradesh (McMahon Line), Gujarat (Sir Creek & Great Rann of Kutch), and both Andaman & Nicobar and Lakshadweep island archipelagos.
   - Computes exact national union with Shapely and simplifies using Douglas–Peucker topology-preserving algorithm (outline 0.010°, states 0.020°), yielding:
     - `india-outline.geojson` — 618 polygons, 8,192 vertices, 144 KB
     - `india-states.geojson` — 36 state/UT simplified interior polygons, 167 KB
     - `india-state-labels.geojson` — 36 label anchor points, 4 KB
     - `bounds.json` — official bbox `[68.186, 6.756, 97.415, 37.078]`, estimated land area 3,304,496 km²
2. **`Map2D.tsx`**:
   - Suppresses Carto basemap's internal conflicting boundary layers (`boundary_country_outline`, `boundary_country_inner`, `boundary_state`, `boundary_county`), ensuring only the official Survey of India border (`ag-land-border` & `ag-land-fill` #101f38) and state boundaries (`ag-states-line`) render.
3. **`indiaGeo.ts`**:
   - Updated `INDIA_BOUNDS` to `[68.15, 6.7, 97.45, 37.15]` to ensure national fitBounds and zone navigation comfortably frame the northernmost peaks of India.
4. **Build verification**:
   - `npm run build` cleanly passed (Vite + TypeScript), assets bundled with zero errors.

---

## 5. Revised PRD & MVP phasing

### MVP-0 — Demo (current, done)
Client-side deterministic simulation + synthetic FastAPI pipeline + corrected India map. Always runnable, no credentials.

### MVP-1 — Live wiring (1–2 weeks)
- `lib/backendAdapter.ts`: normalize backend payload → frontend `StormCell`/`CityWeather` (map F2)
- `useLiveWeatherSocket` promoted from `_legacy/` → auto-connect `ws://localhost:8000/ws/live-stream`, merge server cells over simulation, reconnect + staleness UI (F1, F16)
- Region mapping table backend-region ↔ macro-zone (F7)
- Sensor-health strip + failover toggle + landmarks layer (F8–F10)
- Countdown targets from backend (F6); AI advisory modal (F11); CAP alert banner (F12)
- Legend panel (F15)

### MVP-2 — Real data (3–4 weeks)
- Ingestion adapters: DWR (MOSDAC), INSAT-3DR, DAMINI, AWS (B1)
- TimescaleDB + Redis + MinIO deployed (B3–B5); backend loop switches `DEMO_MODE=false`
- 3 km regional grids (B2); tile service for dBZ/INSAT/lightning (B12)
- Frontend: real reflectivity raster + INSAT TIR overlay (F3, F4); archive charts (F14)

### MVP-3 — Intelligence (3–4 weeks)
- ConvLSTM nowcast frames visualized (F5); model registry + verification metrics (B7)
- Alerting engine with SMS/push/CAP distribution (B6); national cell tracking (B11)
- Historical events + verification against IMD warnings (F13)

### MVP-4 — Hyper-local & public (4+ weeks)
- District-level (1–3 km) hazard zones, district admin console, multilingual warnings (F17, F19)
- Public API + mobile PWA; auth & rate limits (B8); observability dashboards (B9); k8s deployment (B10)

### Success metrics (KPIs for the system itself)
- Data freshness: DWR ≤ 10 min, INSAT ≤ 15 min, lightning ≤ 2 min end-to-end
- CI detection: ≥ 70 % POD, ≤ 15 % false-alarm rate per event
- 0–2 h rain: CSI ≥ 0.4 at 1 mm/h threshold; cloudburst warnings ≥ 15 min lead
- WS delivery: p99 < 500 ms at 500 concurrent clients
- Availability: 99.5 % (ingest degradation → automatic SATELLITE_FALLBACK)

---

## 6. Immediate next steps (ordered)

1. Wire `useLiveWeatherSocket` + write `backendAdapter.ts` (F1/F2) — smallest step that makes the full stack real.
2. Add sensor-health strip + failover toggle (F8/F9) — demonstrates the backend's strongest differentiator.
3. Landmarks layer (F10) — aviation/admin use-case from the PRD.
4. Replace the synthetic generator's grid with regional 3 km tiles (B2) — the PRD's core resolution requirement.
5. Stand up TimescaleDB + Redis, connect the loop to real persistence (B3/B4).
6. First real ingestion adapter: DAMINI lightning (simplest feed, highest visual impact).
