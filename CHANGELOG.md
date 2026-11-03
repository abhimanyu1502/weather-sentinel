# Changelog

All notable changes to the SIH 26084 Nowcasting Platform are documented here.

## [3.0.0] - 2026-10-08
### Added
- Complete Master PRD compliance across all 67 engineering specifications.
- Modular `app/` architecture (`core/`, `api/`, `schemas/`, `ingestion/`, `processing/`, `features/`, `hazard/`, `forecasting/`, `alerts/`).
- Multi-source meteorological ingestion engine (`WeatherProvider` ABC, `ProviderRegistry`, Open-Meteo, IMD, Radar, INSAT-3DR, DAMINI, and deterministic Demo source).
- Spatio-temporal fusion engine with physical bounds validator and dynamic quality scoring.
- Feature extraction pipeline covering thermodynamic indices (CAPE, CIN, LI, K-Index), radar rain rate, MESH hail size, POSH, and overshooting tops.
- Independent multi-hazard engines for Thunderstorm, Hail, and Cloudburst.
- Rolling 0–6 hour forecasting generator producing exact 7-step sequence ($T+0$ to $T+6$) with actionable lead times.
- Early Warning Engine with lead-time calculation, cooldown, and hysteresis.
- Multi-channel warning dispatch: OASIS CAP-CP v1.2 XML, webhooks, email, and SMS.
- Complete test suite: unit, contract, alerting, API, and E2E failure resilience tests (17/17 passing).
- Deterministic demo script (`scripts/generate_demo_event.py`) and historical backtesting suite (`scripts/backfill.py`).
- 100% backward compatibility with the existing frontend dashboard without modifying any frontend code.
