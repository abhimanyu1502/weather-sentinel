"""
Weather Observation API Endpoints.
Complies with Section 24 of SIH 26084 PRD.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from app.ingestion.registry import registry
from app.processing.fusion import DataFusionEngine
from app.schemas.weather import NormalizedWeatherObservation
from app.core.config import settings

router = APIRouter(prefix="/api/v1/weather", tags=["Weather Telemetry"])

# In-memory circular buffer for historical observations
_recent_observations: List[NormalizedWeatherObservation] = []


@router.get("/current")
async def get_current_weather(
    lat: float = Query(default=28.6139, ge=-90.0, le=90.0, description="Latitude"),
    lon: float = Query(default=77.2090, ge=-180.0, le=180.0, description="Longitude"),
    provider: Optional[str] = Query(default=None, description="Optional specific provider name")
):
    """
    Returns normalized current weather conditions for the specified coordinate.
    If provider is not specified, performs multi-source spatio-temporal fusion.
    """
    location = {"lat": lat, "lon": lon}

    if provider:
        p = registry.get(provider)
        if not p:
            raise HTTPException(status_code=404, detail=f"Provider '{provider}' not found.")
        try:
            obs = await p.fetch_current(location)
            _recent_observations.append(obs)
            return {"mode": "SINGLE_PROVIDER", "observation": obs}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Provider fetch failed: {e}")

    # Multi-source fetch & fusion
    observations = await registry.fetch_all(location)
    if not observations:
        # Fallback to demo provider if all external providers are offline
        demo_p = registry.get("demo_synthetic_storm")
        if demo_p:
            obs = await demo_p.fetch_current(location)
            observations = [obs]

    fusion_result = DataFusionEngine.fuse(observations, lat, lon)
    fused_obs = fusion_result.get("fused_observation")
    if fused_obs:
        _recent_observations.append(fused_obs)

    return {
        "mode": "MULTI_SOURCE_FUSION",
        "observation": fused_obs,
        "fusion_confidence": fusion_result.get("fusion_confidence"),
        "source_weights": fusion_result.get("source_weights"),
        "active_sources": [o.source for o in observations],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/history")
async def get_weather_history(
    limit: int = Query(default=20, ge=1, le=100)
):
    """
    Returns historical sequence of recent weather observation snapshots.
    """
    return {
        "total_records": len(_recent_observations),
        "history": list(reversed(_recent_observations[-limit:]))
    }
