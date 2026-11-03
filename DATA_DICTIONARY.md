# SIH 26084 — Meteorological Data Dictionary & Contracts

This document specifies canonical data schemas, physical valid ranges, units, and definitions across the nowcasting platform.

---

### 1. Canonical Weather Observation Schema (`NormalizedWeatherObservation`)

| Field Name | Type | Unit | Physical Range | Description |
|---|---|---|---|---|
| `source` | `str` | - | Valid source ID | Originating sensor adapter or composite identifier |
| `source_timestamp` | `datetime` | UTC | Valid ISO 8601 | Observation timestamp reported by sensor |
| `ingested_timestamp`| `datetime` | UTC | Valid ISO 8601 | Pipeline ingestion timestamp |
| `latitude` | `float` | Degrees | `[-90.0, 90.0]` | Geographic latitude in WGS 84 |
| `longitude` | `float` | Degrees | `[-180.0, 180.0]`| Geographic longitude in WGS 84 |
| `altitude` | `float` | Meters | `[-50.0, 8848.0]`| Station or sensor altitude MSL |
| `temperature_c` | `float` | °C | `[-50.0, 55.0]` | 2m dry-bulb air temperature |
| `dew_point_c` | `float` | °C | `[-50.0, 40.0]` | 2m dew point temperature ($T_d \le T$) |
| `relative_humidity` | `float` | % | `[0.0, 100.0]` | Relative humidity |
| `surface_pressure_hpa`| `float` | hPa | `[800.0, 1085.0]`| Station surface barometric pressure |
| `wind_speed_ms` | `float` | m/s | `[0.0, 120.0]` | 10m sustained horizontal wind speed |
| `wind_direction_deg`| `float` | Degrees | `[0.0, 360.0]` | Meteorological wind direction |
| `wind_gust_ms` | `float` | m/s | `[0.0, 160.0]` | Maximum wind gust ($V_{\text{gust}} \ge V_{\text{sustained}}$) |
| `precipitation_mm` | `float` | mm | `[0.0, 1000.0]` | Accumulated liquid water precipitation |
| `precipitation_rate_mm_h` | `float`| mm/h | `[0.0, 300.0]` | Instantaneous or hourly rain rate ($\ge 100\text{ mm/h} = \text{Cloudburst}$) |
| `cloud_cover_pct` | `float` | % | `[0.0, 100.0]` | Total fractional cloud cover |
| `lightning_count` | `int` | strokes | `[0, 500]` | Total detected ground/cloud strokes in cell (5-15 min) |
| `radar_reflectivity_dbz`| `float` | dBZ | `[-15.0, 80.0]` | Equivalent radar reflectivity factor $Z$ |
| `radar_velocity_ms`| `float` | m/s | `[-100.0, 100.0]`| Mean Doppler radial velocity |
| `satellite_cloud_top_temperature_c`| `float` | °C | `[-100.0, 40.0]` | INSAT TIR1 10.8µm cloud-top brightness temperature |
| `cape_j_kg` | `float` | J/kg | `[0.0, 7500.0]` | Convective Available Potential Energy |
| `cin_j_kg` | `float` | J/kg | `[0.0, 2000.0]` | Convective Inhibition energy |
| `lifted_index` | `float` | K | `[-20.0, 30.0]` | Lifted Index ($< -4\text{ K} = \text{Severe Instability}$) |
| `vertical_wind_shear`| `float`| m/s | `[0.0, 80.0]` | 0–6 km bulk wind shear |
| `data_quality_score`| `float` | Score | `[0.0, 1.0]` | Computed validation plausibility credibility score |
| `quality_status` | `str` | - | `PASSED, FLAGGED, REJECTED` | Quality control outcome flag |

---

### 2. Feature Vector Contract (`FeaturePipeline`)

- `atmospheric.dew_point_depression_c`: $T - T_d$ (moisture proximity).
- `atmospheric.k_index`: Deep moist convection index.
- `atmospheric.total_totals_index`: Severe storm potential indicator.
- `precipitation.accum_1h_mm`: 1-hour projected rainfall accumulation.
- `precipitation.is_cloudburst_rate`: Boolean flag when $\text{rain rate} \ge 100\text{ mm/h}$.
- `radar.hail_mesh_mm`: Maximum Expected Size of Hail in millimeters.
- `radar.hail_posh_pct`: Probability of Severe Hail ($\ge 60\% = \text{Severe warning}$).
- `radar.downburst_gust_kmh`: Divergence microburst estimated surface gust velocity.
- `satellite.cooling_intensity_score`: Fractional overshooting top cooling intensity $[0.0 - 1.0]$.
- `satellite.overshooting_top_detected`: Boolean flag for $T_{\text{cloud}} \le -65^\circ\text{C}$.

---

### 3. Forecast Object Contract (`SixHourForecast`)

- `forecast_generated_at`: ISO 8601 UTC timestamp of cycle computation.
- `horizon_hours`: Static constant `6`.
- `event_start_estimate`: Target timestamp where severity first breaches `HIGH`/`SEVERE`.
- `lead_time_minutes`: Computed actionable early warning lead time ($0 - 360$ minutes).
- `lead_time_hours`: Computed lead time in decimal hours ($0.0 - 6.0$).
- `predictions`: Exactly 7 elements for $T+0, T+1, T+2, T+3, T+4, T+5, T+6$.
