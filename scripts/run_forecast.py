"""
run_forecast.py — Executes a 0-6h forecast cycle across regional domains.
Complies with Section 5 and Section 19 of SIH 26084 PRD.
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

from app.ingestion.registry import registry
from app.main import initialize_providers
from app.processing.fusion import DataFusionEngine
from app.features.feature_pipeline import FeaturePipeline
from app.hazard.ensemble import HazardEnsembleEngine
from app.forecasting.baseline import ForecastGenerator


async def main():
    print("🔮 Executing 0–6 Hour Convective Nowcast Run...")
    initialize_providers()

    target_lat = 26.8467
    target_lon = 80.9462
    location = {"lat": target_lat, "lon": target_lon}

    observations = await registry.fetch_all(location)
    fusion_result = DataFusionEngine.fuse(observations, target_lat, target_lon)
    fused_obs = fusion_result["fused_observation"]
    features = FeaturePipeline.extract_features(fused_obs)

    assessment = HazardEnsembleEngine.evaluate(features, location, grid_id="GRID-LUCKNOW")
    forecast = ForecastGenerator.generate_6h_forecast(
        current_assessment=assessment.model_dump(),
        features=features,
        lat=target_lat,
        lon=target_lon,
        grid_id="GRID-LUCKNOW"
    )

    print(f"\n✅ 0-6h Forecast Generated for {forecast.grid_id}:")
    print(f"  • Generated At: {forecast.forecast_generated_at}")
    print(f"  • Peak Severity: {forecast.peak_severity.value} ({int(forecast.peak_risk_score * 100)}%)")
    print(f"  • Primary Threat: {forecast.primary_hazard.value if forecast.primary_hazard else 'None'}")
    print(f"  • Actionable Lead Time: {forecast.lead_time_minutes or 0} min ({forecast.lead_time_hours or 0} hrs)")
    print("\nHourly Trajectory (T+0 to T+6):")
    for p in forecast.predictions:
        print(f"  T+{p.timestep} ({p.lead_time_minutes:3d}m) -> Risk: {int(p.composite_risk_score*100):2d}% | {p.severity.value:<8} | Rain: {p.expected_rain_rate_mm_h:.1f} mm/h | dBZ: {p.expected_radar_dbz:.1f}")


if __name__ == "__main__":
    asyncio.run(main())
