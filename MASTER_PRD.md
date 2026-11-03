# SIH 26084 — 6-Hour Convective Weather Nowcasting & Early Warning System
## Antigravity Master PRD + Engineering Execution Plan

**Problem Statement:** SIH26084 — Convective scale nowcasting for Thunderstorms, Hail & Cloudbursts (06 hr)  
**Nodal Organization:** Ministry of Earth Sciences (MoES)  
**Theme:** Disaster Management  
**Primary goal:** Build a legitimate, demonstrable backend and web system that ingests heterogeneous weather data, validates/fuses it, detects convective risk, produces a rolling 0–6 hour hazard forecast, and issues warnings early enough for action.

> **Critical engineering rule:** Do not claim that an LLM itself predicts thunderstorms. Qwen/Ollama is optional for explanation, operator assistance, report generation and natural-language alert interpretation. The numerical/hazard prediction layer must operate from meteorological data and explicit features/models.

---

# 1. PRODUCT VISION

Build a production-shaped early-warning platform with this flow:

```text
Weather APIs / Radar / Satellite / Lightning / NWP / Ground observations
                              |
                              v
                    Multi-source ingestion
                              |
                              v
                Validation + normalization
                              |
                              v
                  Time/spatial alignment
                              |
                              v
                 Feature extraction engine
                              |
                              v
                 Hazard/anomaly engine
                              |
                 +------------+-------------+
                 |            |             |
                 v            v             v
            Thunderstorm     Hail       Cloudburst
                 |            |             |
                 +------------+-------------+
                              |
                              v
                    0–6 hour risk grid
                              |
                              v
                 Confidence + severity score
                              |
                              v
             6-hour early-warning decision
                              |
              +---------------+----------------+
              |               |                |
              v               v                v
          REST API        GIS dashboard    Alert service
                                             SMS/Email/
                                             WhatsApp/etc.
```

The system must continue working when one external weather source fails.

---

# 2. SIH 26084 ALIGNMENT

The solution must target:

- 0–6 hour short-term nowcasting.
- Convective-scale hazards.
- Thunderstorm detection/risk.
- Hail probability/risk.
- Cloudburst/heavy-rain risk.
- Multi-source meteorological data fusion.
- Hyper-local spatial output, targeting approximately 1–3 km where source resolution permits.
- Interactive GIS visualization.
- Live countdown/time-to-event.
- Explainable warning reasons.
- Real-time ingestion and processing.
- Graceful degradation when an API/source is unavailable.

The official problem description emphasizes high-frequency heterogeneous streams such as Doppler Weather Radar, INSAT satellite imagery and lightning observations. Treat those as the target architecture even if the initial MVP uses accessible APIs/synthetic or historical data for demonstration.

---

# 3. NON-NEGOTIABLE SYSTEM REQUIREMENTS

## 3.1 Six-hour requirement

Every forecast cycle must generate predictions for:

```text
T+0
T+1
T+2
T+3
T+4
T+5
T+6 hours
```

Do not simply issue an alert at the moment an anomaly is detected.

The system must maintain:

```text
forecast_generated_at
event_start_estimate
lead_time_minutes
lead_time_hours
confidence
severity
hazard_type
affected_grid_cells
```

The warning engine should prefer an alert when:

```text
predicted_event_time - current_time >= configured minimum lead time
```

For the hackathon acceptance test, create scenarios where the system identifies a severe event with **at least 6 hours of actionable lead time where the available data supports that lead time**.

Important scientific distinction:

- SIH 26084 is a 0–6 hour nowcasting problem.
- A true 6-hour lead warning is not guaranteed for every convective event.
- Never fabricate a six-hour prediction merely to pass a demo.
- Measure and display actual lead time and confidence.

---

# 4. RECOMMENDED ARCHITECTURE

## 4.1 Backend

Use:

- Python 3.11+
- FastAPI
- Pydantic v2
- Uvicorn
- Async HTTP ingestion
- PostgreSQL
- PostGIS
- Redis
- APScheduler
- Pandas
- NumPy
- SciPy
- Scikit-learn
- Shapely
- httpx
- tenacity
- loguru / structlog
- Prometheus instrumentation

---

# 5. PYTHON PROJECT STRUCTURE

```text
weather-nowcast/
│
├── README.md
├── MASTER_PRD.md
├── ARCHITECTURE.md
├── API_DOCUMENTATION.md
├── DATA_DICTIONARY.md
├── MODEL_CARD.md
├── TEST_PLAN.md
├── DEPLOYMENT.md
├── SECURITY.md
├── OPERATIONS.md
├── CHANGELOG.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt
├── pyproject.toml
│
├── app/
│   ├── main.py
│   ├── core/
│   ├── api/
│   ├── schemas/
│   ├── ingestion/
│   ├── processing/
│   ├── features/
│   ├── hazard/
│   ├── forecasting/
│   ├── alerts/
│   ├── database/
│   ├── jobs/
│   ├── observability/
│   └── utils/
│
├── data/
├── scripts/
├── tests/
└── docs/
```
