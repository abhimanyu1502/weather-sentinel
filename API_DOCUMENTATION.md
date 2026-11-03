# SIH 26084 — REST API Specification & Integration Guide

The AntiGravity platform provides an OpenAPI 3.1 compliant REST API and high-cadence WebSockets.

---

### 1. Health & System Telemetry

#### `GET /health`
- **Description:** Verifies service uptime and runtime dependencies.
- **Response `200 OK`:**
  ```json
  {
    "status": "healthy",
    "service": "SIH26084-WeatherNowcast",
    "version": "1.0.0",
    "environment": "development",
    "database": "operational",
    "redis": "operational",
    "timestamp": "2026-10-08T00:00:00Z"
  }
  ```

#### `GET /health/providers`
- **Description:** Probes connectivity, latencies, and operational status for all registered weather sources.
- **Response `200 OK`:**
  ```json
  {
    "overall_status": "OPERATIONAL",
    "providers": {
      "source_a_open_meteo": { "status": "OPERATIONAL", "latency_ms": 320.5, "healthy": true },
      "radar_dwr_composite": { "status": "OPERATIONAL", "healthy": true },
      "satellite_insat_3dr": { "status": "OPERATIONAL", "healthy": true }
    }
  }
  ```

---

### 2. Weather Observation Endpoints

#### `GET /api/v1/weather/current`
- **Query Parameters:**
  - `lat` (float, required): Target latitude (e.g. `28.6139`)
  - `lon` (float, required): Target longitude (e.g. `77.2090`)
  - `provider` (string, optional): Specific provider filter
- **Description:** Returns multi-source fused observation with source weights and quality score.

#### `GET /api/v1/weather/history`
- **Query Parameters:** `limit` (integer, default 20)
- **Description:** Returns historical observation snapshots for trend analysis.

---

### 3. Rolling 0–6 Hour Forecasting

#### `GET /api/v1/forecast`
- **Query Parameters:** `lat`, `lon`
- **Description:** Generates rolling 0–6 hour hourly convective hazard predictions ($T+0$ to $T+6$).
- **Response `200 OK` Sample:**
  ```json
  {
    "grid_id": "GRID-3KM-28.61-77.21",
    "latitude": 28.6139,
    "longitude": 77.2090,
    "forecast_generated_at": "2026-10-08T01:00:00Z",
    "horizon_hours": 6,
    "event_start_estimate": "2026-10-08T06:30:00Z",
    "lead_time_minutes": 330,
    "lead_time_hours": 5.5,
    "peak_severity": "SEVERE",
    "primary_hazard": "thunderstorm",
    "peak_risk_score": 0.88,
    "confidence": 0.85,
    "predictions": [
      {
        "timestep": 0,
        "valid_time": "2026-10-08T01:00:00Z",
        "lead_time_minutes": 0,
        "thunderstorm_probability": 0.20,
        "hail_probability": 0.05,
        "cloudburst_probability": 0.05,
        "composite_risk_score": 0.20,
        "severity": "LOW",
        "confidence": 0.85
      },
      {
        "timestep": 6,
        "valid_time": "2026-10-08T07:00:00Z",
        "lead_time_minutes": 360,
        "thunderstorm_probability": 0.88,
        "hail_probability": 0.42,
        "cloudburst_probability": 0.72,
        "composite_risk_score": 0.88,
        "severity": "SEVERE",
        "confidence": 0.65
      }
    ]
  }
  ```

---

### 4. Hazard & Spatial Mapping

#### `GET /api/v1/hazards`
- **Description:** Returns individual assessments for Thunderstorm, Hail, and Cloudburst with physical triggers.

#### `GET /api/v1/risk-map`
- **Query Parameters:** `min_lat`, `max_lat`, `min_lon`, `max_lon`
- **Description:** Returns GeoJSON FeatureCollection of spatial grid polygons with risk scores for MapLibre/Leaflet.

---

### 5. Early Warnings & Alerts

#### `GET /api/v1/alerts`
- **Description:** Lists recent active warnings, lead times, and dispatch statuses.

#### `POST /api/v1/alerts/test`
- **Query Parameters:** `hazard`, `severity`, `lead_time_minutes`
- **Description:** Dispatches a test early warning across all alert channels.

#### `GET /api/alerts/cap`
- **Description:** Exports OASIS CAP-CP v1.2 XML for national sirens and cell-broadcast integration.

---

### 6. Mission Control WebSockets

#### `ws://localhost:8000/ws/live-stream`
- **Description:** National real-time streaming channel broadcasting cell segmentation, radar dBZ, convective initiation flags, and countdowns every 3 seconds.

#### `ws://localhost:8000/ws/regions/{region_id}`
- **Description:** Regional live channel (`WEST_INDIA`, `NORTH_INDIA`, `EAST_INDIA`, `SOUTH_INDIA`, `NORTHWEST`, `NORTHEAST`).
