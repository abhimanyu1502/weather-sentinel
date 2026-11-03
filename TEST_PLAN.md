# SIH 26084 — Master Test Plan & Quality Assurance

### 1. Test Strategy Overview
The testing architecture spans seven distinct verification gates to ensure operational resilience and numerical fidelity:

1. **Unit Tests (`tests/unit/`):**
   - Physics Plausibility Checks: Physical boundary conditions for temperature, humidity, wind, and reflectivity.
   - Atmospheric Feature Extraction: CAPE, Lifted Index, and moist convective potential formulas.
   - Hazard Engines: Evaluation of Thunderstorm, Hail (MESH/POSH), and Cloudburst thresholds.
   - 0–6h Forecast Horizon: Validation of exact 7-step sequence ($T+0$ to $T+6$).

2. **Contract Tests (`tests/contract/`):**
   - Verification that every provider adapter adheres to the `WeatherProvider` ABC and emits valid `NormalizedWeatherObservation` instances.

3. **Alerting Tests (`tests/alerting/`):**
   - Actionable Lead Time: Verification of 6-hour lead time identification and minimum lead time handling.
   - Hysteresis & Deduplication: Prevention of rapid oscillation between severity levels.

4. **API Integration Tests (`tests/api/`):**
   - Master PRD endpoints: `/health`, `/health/providers`, `/api/v1/forecast`, `/api/v1/hazards`, `/api/v1/alerts`.
   - Frontend Compatibility endpoints: `/api/landmarks`, `/api/regions`, `/api/dashboard/summary`, `/api/alerts/cap`.

5. **End-to-End Failure Resilience (`tests/e2e/`):**
   - Provider Outage Injection: Remote API 500, network timeouts, and partial payloads. Verification of non-crashing graceful degradation.

6. **Historical Backtesting (`scripts/backfill.py`):**
   - Calculation of POD, FAR, CSI, Brier Score, and lead-time distributions across historical Indian storms.

7. **System Correctness Suite (`test_backend_correctness.py`):**
   - Universal end-to-end check across physics, tensor fusion, kinematics, ConvLSTM, and live API ingestion.

---

### 2. Execution Commands
```bash
# Run complete pytest test suite
pytest tests/ -v

# Run system correctness validator
python test_backend_correctness.py

# Run historical backtesting
python scripts/backfill.py

# Run 6-hour deterministic demo event simulator
python scripts/generate_demo_event.py
```
