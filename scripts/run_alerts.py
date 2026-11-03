"""
run_alerts.py — Evaluates early warning conditions and tests dispatch channels.
Complies with Section 5 and Section 20 of SIH 26084 PRD.
"""

import sys
import asyncio
from pathlib import Path

# Ensure Windows terminal doesn't crash on UTF-8 emojis
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.alerts.engine import warning_engine
from app.ingestion.sources.demo_source import DemoWeatherProvider
from app.features.feature_pipeline import FeaturePipeline
from app.hazard.ensemble import HazardEnsembleEngine
from app.forecasting.baseline import ForecastGenerator


async def main():
    print("🚨 Executing Warning Engine Evaluation...")
    demo = DemoWeatherProvider()
    demo.set_stage(4)  # Severe stage
    loc = {"lat": 19.0760, "lon": 72.8777}

    obs = await demo.fetch_current(loc)
    features = FeaturePipeline.extract_features(obs)
    assessment = HazardEnsembleEngine.evaluate(features, loc, grid_id="GRID-MUMBAI")
    forecast = ForecastGenerator.generate_6h_forecast(
        assessment.model_dump(),
        features,
        lat=19.0760,
        lon=72.8777,
        grid_id="GRID-MUMBAI"
    )

    alert = await warning_engine.evaluate_forecast(forecast, location_meta={"name": "Mumbai Metropolitan Region", "state": "Maharashtra"})
    if alert:
        print(f"\n✅ Warning Dispatched: {alert.alert_id}")
        print(f"  • Hazard: {alert.hazard.value.upper()} | Severity: {alert.severity.value}")
        print(f"  • Lead Time: {alert.lead_time_minutes} minutes ({alert.lead_time_hours} hours)")
        print(f"  • Triggers: {alert.reasons}")
    else:
        print("No warning issued under current criteria.")


if __name__ == "__main__":
    asyncio.run(main())
