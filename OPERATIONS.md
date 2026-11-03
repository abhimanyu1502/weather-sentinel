# SIH 26084 — Operational Runbook & Maintenance Guide

### 1. Incident Response Procedures

#### Scenario A: Live Weather API (Source A) Outage
- **Observation:** `GET /health/providers` reports `source_a_open_meteo` as `OFFLINE`.
- **Automatic System Action:** Circuit breaker trips to `OPEN`. Data fusion automatically shifts weight to `source_b_imd_synoptic` and radar/satellite feeds.
- **Operator Action:** No urgent intervention required. System automatically tests recovery after 45 seconds (`HALF_OPEN`).

#### Scenario B: Severe Convective Alert Flooding
- **Observation:** Rapid storm cell updates triggering alert churn.
- **Mitigation:** The built-in `AlertDeduplicator` enforces a 10-minute cooldown window on identical severity alerts. To adjust threshold, modify `MIN_WARNING_LEAD_MINUTES` in `.env`.

---

### 2. Routine Maintenance

#### Database Cleanup
Run weekly to archive observations older than 30 days:
```sql
DELETE FROM weather_observations WHERE source_timestamp < NOW() - INTERVAL '30 days';
```

#### Provider Health Audit
```bash
python scripts/validate_sources.py
```
