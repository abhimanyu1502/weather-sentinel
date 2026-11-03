# SIH 26084 — System Architecture Document
## Convective-Scale Weather Nowcasting & 6-Hour Early Warning Platform

### 1. Architectural Overview

```text
+----------------------------------------------------------------------------------------------------+
|                                    METEOROLOGICAL INGESTION LAYER                                  |
|  [Open-Meteo REST]   [IMD Synoptic]   [DWR Radar Mosaic]   [INSAT-3DR TIR]   [DAMINI Lightning]   |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                  VALIDATION & QUALITY CONTROL (QC)                                 |
|  - Physical plausibility checks (Temp: -50..55°C, RH: 0..100%, Wind >= 0, Gust >= Sustained)       |
|  - Clock-skew & stale-timestamp detection (max 6h)                                                 |
|  - Data quality score calculation [0.0 - 1.0]                                                      |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                SPATIO-TEMPORAL MULTI-SOURCE FUSION                                 |
|  - Temporal alignment across 1m, 5m, 10m, 15m, 30m, 60m cadences                                   |
|  - Dynamic source reliability weighting (Radar: 0.96, DAMINI: 0.94, Open-Meteo: 0.91, INSAT: 0.88)|
|  - Hyper-local spatial projection (1–3 km target mesh)                                             |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                     FEATURE EXTRACTION ENGINE                                      |
|  - Atmospheric Instability: CAPE, CIN, Lifted Index, K-Index, Total Totals, Dew Point Depression    |
|  - Severe Radar Kinematics: Marshall-Palmer Z-R rain rate, MESH hail size, POSH, Microburst shear |
|  - Satellite & Lightning: Cloud-top cooling rate (CTCR), Overshooting tops, Stroke density / 5min  |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                      HAZARD & ANOMALY ENGINE                                       |
|               +-------------------+-----------------+--------------------+                         |
|               |                   |                 |                    |                         |
|               v                   v                 v                    v                         |
|        Thunderstorm Risk      Hail Risk      Cloudburst Deluge   Downburst Microburst              |
|        (CAPE, dBZ, CTCR)    (MESH, POSH)     (Rain >= 100mm/h)   (Delta-V Divergence)              |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                  0–6 HOUR ROLLING FORECAST GRID                                    |
|  Exact 7-step hourly trajectory: T+0, T+1, T+2, T+3, T+4, T+5, T+6 hours                            |
|  Maintains: forecast_generated_at, event_start_estimate, lead_time_minutes, confidence, severity   |
+----------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+----------------------------------------------------------------------------------------------------+
|                                  6-HOUR EARLY WARNING ENGINE                                       |
|  - Decision logic: severe_prob >= 0.65 AND confidence >= 0.55 AND lead_time >= min_lead            |
|  - Cooldown, hysteresis, and deduplication preventing alert oscillation                             |
|  - Dispatches: OASIS CAP-CP v1.2 XML, Webhooks, Emergency SMS, Email bulletins                     |
+----------------------------------------------------------------------------------------------------+
                                                  |
                   +------------------------------+------------------------------+
                   |                                                             |
                   v                                                             v
+--------------------------------------+                     +---------------------------------------+
|             REST & WS API            |                     |             GIS DASHBOARD             |
|  - OpenAPI 3.1 (/docs, /redoc)       |                     |  - MapLibre GL 2D / 3D Tactical Map   |
|  - WebSocket Live Stream (/ws/...)   |                     |  - 0–6h Horizon Countdown Timers      |
|  - Master PRD Endpoints (/api/v1/...) |                     |  - District & Landmark Threat Alerts  |
+--------------------------------------+                     +---------------------------------------+
```

---

### 2. Core Subsystems

#### 2.1 Multi-API Ingestion Subsystem (`app/ingestion/`)
- Abstract Base Class: `WeatherProvider` defining `fetch_current`, `fetch_forecast`, and `health_check`.
- Registry: `ProviderRegistry` allows dynamic zero-downtime enable/disable, health probing, and circuit-breaker isolation.
- Resilience: `execute_with_retry` implements exponential backoff and circuit breaker state tracking. If an external provider (such as Open-Meteo or IMD) fails, the system automatically falls back to secondary and synthetic demo providers without service disruption.

#### 2.2 Processing & Fusion Engine (`app/processing/`)
- `TemporalAligner`: Canonicalizes disparate temporal update cadences into synchronized timestamps without naive long-gap forward filling.
- `SpatialGridManager`: Discretizes spatial regions into 1–3 km or 5 km cells with deterministic identifiers (`GRID-3KM-{lat}-{lon}`).
- `DataFusionEngine`: Computes dynamically weighted composites based on sensor base reliability, observation freshness decay, and cross-source consensus.

#### 2.3 Feature Extraction Engine (`app/features/`)
- `AtmosphericFeatureExtractor`: Derives CAPE, CIN, Lifted Index, K-Index, Total Totals, and Moist Convective Potential.
- `PrecipitationFeatureExtractor`: Applies Marshall–Palmer $Z = 300 R^{1.4}$ radar rain rate estimation and multi-hour accumulation projections.
- `RadarFeatureExtractor`: Derives Maximum Expected Size of Hail (MESH in mm), Probability of Severe Hail (POSH in %), and downburst divergence.
- `SatelliteFeatureExtractor`: Measures cloud-top cooling rates (CTCR) and identifies severe overshooting convective cloud tops ($T \le -65^\circ\text{C}$).

#### 2.4 Hazard Assessment & 0–6h Forecasting (`app/hazard/`, `app/forecasting/`)
- Computes calibrated risk probabilities $[0.0, 1.0]$ for Thunderstorm, Hail, and Cloudburst.
- Maps risk scores to standard IMD severity tiers: `LOW` ($<0.25$), `MODERATE` ($0.25-0.49$), `HIGH` ($0.50-0.74$), `SEVERE` ($\ge 0.75$).
- Forecast generator builds an exact 7-step sequence for $T+0, T+1, T+2, T+3, T+4, T+5, T+6$ hours with explicit lead-time metrics and confidence bounds.

#### 2.5 Early Warning Engine (`app/alerts/`)
- Computes actionable lead time ($\Delta t = t_{\text{event}} - t_{\text{now}}$).
- Implements hysteresis and cooldown filters to eliminate false-alarm oscillations.
- Dispatches emergency alerts across CAP v1.2 XML, webhooks, and notifications.
