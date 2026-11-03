"""
System Status and Administrative Endpoints.
Complies with Section 24 and Section 51 of SIH 26084 PRD.
"""

from fastapi import APIRouter, Path, Depends, HTTPException
from datetime import datetime, timezone
from typing import Dict, Any
from app.ingestion.registry import registry
from app.core.config import settings
from app.core.security import verify_admin_key
from app.alerts.engine import warning_engine

router = APIRouter(prefix="/api/v1", tags=["Admin & System Status"])


@router.get("/system/status")
async def get_system_status():
    """
    Returns comprehensive platform status including health, providers, and alerts.
    """
    providers = await registry.health_check_all()
    recent_alerts = warning_engine.get_recent_alerts(limit=5)

    return {
        "status": "OPERATIONAL",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "providers_count": len(registry.list_all()),
        "enabled_providers": [p.name for p in registry.list_enabled()],
        "provider_health": providers,
        "recent_alerts_count": len(recent_alerts),
        "target_lead_hours": settings.TARGET_WARNING_LEAD_HOURS,
        "min_lead_minutes": settings.MIN_WARNING_LEAD_MINUTES
    }


@router.post("/admin/providers/{name}/enable", dependencies=[Depends(verify_admin_key)])
async def enable_provider(name: str = Path(...)):
    ok = registry.enable(name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Provider '{name}' not found.")
    return {"status": "SUCCESS", "provider": name, "enabled": True}


@router.post("/admin/providers/{name}/disable", dependencies=[Depends(verify_admin_key)])
async def disable_provider(name: str = Path(...)):
    ok = registry.disable(name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Provider '{name}' not found.")
    return {"status": "SUCCESS", "provider": name, "enabled": False}


@router.post("/admin/forecast/run", dependencies=[Depends(verify_admin_key)])
async def trigger_forecast_cycle():
    """
    Triggers an immediate out-of-band forecast generation run.
    """
    return {
        "status": "FORECAST_CYCLE_TRIGGERED",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/admin/ingestion/run", dependencies=[Depends(verify_admin_key)])
async def trigger_ingestion_cycle():
    """
    Triggers an immediate multi-source weather ingestion run.
    """
    obs = await registry.fetch_all({"lat": settings.DEFAULT_LAT, "lon": settings.DEFAULT_LON})
    return {
        "status": "INGESTION_CYCLE_TRIGGERED",
        "ingested_sources_count": len(obs),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
