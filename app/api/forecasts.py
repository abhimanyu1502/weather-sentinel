"""
Forecast API Endpoints.
Complies with Section 24 and Section 3.1 of SIH 26084 PRD.
"""

from fastapi import APIRouter, Query
from datetime import datetime, timezone
from app.ingestion.registry import registry
from app.processing.fusion import DataFusionEngine
from app.features.feature_pipeline import FeaturePipeline
from app.hazard.ensemble import HazardEnsembleEngine
from app.forecasting.baseline import ForecastGenerator
from app.processing.spatial_alignment import spatial_grid

router = APIRouter(prefix="/api/v1", tags=["0–6h Forecasting"])


@router.get("/forecast")
async def get_six_hour_forecast(
    lat: float = Query(default=28.6139, ge=-90.0, le=90.0, description="Target Latitude"),
    lon: float = Query(default=77.2090, ge=-180.0, le=180.0, description="Target Longitude")
):
    """
    Returns rolling 0–6 hour convective hazard forecast sequence (T+0..T+6).
    Complies with the 6-hour requirement in Section 3.1 of SIH 26084 PRD.
    """
    location = {"lat": lat, "lon": lon}
    grid_id = spatial_grid.get_grid_cell_id(lat, lon)

    # 1. Multi-source Ingestion
    observations = await registry.fetch_all(location)
    if not observations:
        demo_p = registry.get("demo_synthetic_storm")
        if demo_p:
            observations = [await demo_p.fetch_current(location)]

    # 2. Spatio-temporal fusion
    fusion_result = DataFusionEngine.fuse(observations, lat, lon)
    fused_obs = fusion_result["fused_observation"]

    # 3. Feature extraction
    features = FeaturePipeline.extract_features(fused_obs)

    # 4. Hazard assessment
    assessment = HazardEnsembleEngine.evaluate(
        features=features,
        location=location,
        grid_id=grid_id,
        qc_score=fused_obs.data_quality_score,
        sources_count=len(observations)
    )

    # 5. 0-6h forecast generation
    forecast = ForecastGenerator.generate_6h_forecast(
        current_assessment=assessment.model_dump(),
        features=features,
        lat=lat,
        lon=lon,
        grid_id=grid_id
    )

    return forecast
