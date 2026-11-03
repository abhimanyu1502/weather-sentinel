"""
Hazard Evaluation and Risk Map Endpoints.
Complies with Section 17, 18, and 24 of SIH 26084 PRD.
"""

from fastapi import APIRouter, Query, Path, HTTPException
from typing import Optional, Dict, Any
from app.ingestion.registry import registry
from app.processing.fusion import DataFusionEngine
from app.features.feature_pipeline import FeaturePipeline
from app.hazard.ensemble import HazardEnsembleEngine
from app.hazard.thresholds import HazardThresholds
from app.processing.spatial_alignment import spatial_grid

router = APIRouter(prefix="/api/v1", tags=["Hazards & Risk Mapping"])


@router.get("/hazards")
async def get_multi_hazard_assessment(
    lat: float = Query(default=28.6139, ge=-90.0, le=90.0),
    lon: float = Query(default=77.2090, ge=-180.0, le=180.0)
):
    """
    Returns multi-hazard assessment across Thunderstorm, Hail, and Cloudburst.
    """
    location = {"lat": lat, "lon": lon}
    grid_id = spatial_grid.get_grid_cell_id(lat, lon)

    observations = await registry.fetch_all(location)
    if not observations:
        demo_p = registry.get("demo_synthetic_storm")
        if demo_p:
            observations = [await demo_p.fetch_current(location)]

    fusion_result = DataFusionEngine.fuse(observations, lat, lon)
    fused_obs = fusion_result["fused_observation"]
    features = FeaturePipeline.extract_features(fused_obs)

    assessment = HazardEnsembleEngine.evaluate(
        features=features,
        location=location,
        grid_id=grid_id,
        qc_score=fused_obs.data_quality_score,
        sources_count=len(observations)
    )
    return assessment


@router.get("/hazards/{hazard}")
async def get_specific_hazard(
    hazard: str = Path(..., description="thunderstorm | hail | cloudburst"),
    lat: float = Query(default=28.6139, ge=-90.0, le=90.0),
    lon: float = Query(default=77.2090, ge=-180.0, le=180.0)
):
    """
    Returns single hazard details (risk probability, severity, triggers, evidence).
    """
    hazard_norm = hazard.lower().strip()
    if hazard_norm not in ["thunderstorm", "hail", "cloudburst"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid hazard type '{hazard}'. Supported: thunderstorm, hail, cloudburst."
        )

    all_hazards = await get_multi_hazard_assessment(lat=lat, lon=lon)
    eval_obj = getattr(all_hazards, hazard_norm)
    return {
        "hazard": hazard_norm,
        "evaluation": eval_obj,
        "location": {"lat": lat, "lon": lon},
        "timestamp": all_hazards.timestamp
    }


@router.get("/risk-map")
async def get_spatial_risk_map(
    min_lat: float = Query(default=26.0),
    max_lat: float = Query(default=30.0),
    min_lon: float = Query(default=75.0),
    max_lon: float = Query(default=79.0)
):
    """
    Returns hyper-local spatial grid mesh with risk scores and severity
    for interactive GIS dashboard mapping.
    """
    mesh = spatial_grid.generate_regional_grid(min_lat, max_lat, min_lon, max_lon, max_cells=36)

    features = []
    for cell in mesh:
        # Sample synthetic risk gradient for demo visualization
        dist_factor = abs(cell["latitude"] - 28.6) + abs(cell["longitude"] - 77.2)
        score = max(0.05, min(0.95, round(1.0 - (dist_factor / 4.0), 2)))
        sev = HazardThresholds.get_severity(score)

        features.append({
            "type": "Feature",
            "properties": {
                "grid_id": cell["grid_id"],
                "risk_score": score,
                "severity": sev.value,
                "primary_hazard": "thunderstorm" if score > 0.4 else "none"
            },
            "geometry": cell["geometry"]
        })

    return {
        "type": "FeatureCollection",
        "resolution_km": spatial_grid.resolution_km,
        "features": features
    }
