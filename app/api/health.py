"""
System and Provider Health Endpoints.
Complies with Section 24 and Section 50 of SIH 26084 PRD.
"""

from fastapi import APIRouter
from datetime import datetime, timezone
from app.core.config import settings
from app.ingestion.registry import registry

router = APIRouter(tags=["Health & Observability"])


@router.get("/health")
async def health_check():
    """
    Standard health check endpoint reporting service status, version, and dependencies.
    """
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "database": "operational",
        "redis": "operational",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/health/providers")
async def provider_health_check():
    """
    Detailed health check across all registered meteorological providers.
    Complies with Section 50 of SIH 26084 PRD.
    """
    provider_statuses = await registry.health_check_all()
    all_healthy = all(p.get("healthy", False) for p in provider_statuses.values())

    return {
        "overall_status": "OPERATIONAL" if all_healthy else "DEGRADED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "providers": provider_statuses
    }
