"""
Alerts and Early Warning REST Endpoints.
Complies with Section 20, 21, and 24 of SIH 26084 PRD.
"""

from fastapi import APIRouter, Query, Path, HTTPException
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from app.alerts.engine import warning_engine
from app.schemas.alert import AlertObject
from app.schemas.hazard import HazardType, SeverityLevel
from app.schemas.forecast import SixHourForecast, HourlyPrediction

router = APIRouter(prefix="/api/v1/alerts", tags=["Early Warnings & Alerts"])


@router.get("")
async def get_alerts(limit: int = Query(default=20, ge=1, le=100)):
    """
    Returns list of active and recent early warnings.
    """
    alerts = warning_engine.get_recent_alerts(limit=limit)
    return {
        "count": len(alerts),
        "alerts": alerts
    }


@router.get("/{alert_id}")
async def get_alert_by_id(alert_id: str = Path(...)):
    """
    Returns details for a specific early warning alert identifier.
    """
    alert = warning_engine.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return alert


@router.post("/test")
async def trigger_test_alert(
    hazard: str = Query(default="thunderstorm", description="thunderstorm | hail | cloudburst"),
    severity: str = Query(default="SEVERE", description="MODERATE | HIGH | SEVERE"),
    lead_time_minutes: int = Query(default=340, ge=30, le=360, description="Lead time in minutes (up to 6h)")
):
    """
    Emits a test early warning scenario for system validation and demonstration.
    """
    now = datetime.now(timezone.utc)
    event_start = now + timedelta(minutes=lead_time_minutes)

    haz_enum = HazardType(hazard.lower())
    sev_enum = SeverityLevel(severity.upper())

    # Create synthetic test forecast that satisfies warning triggers
    synthetic_forecast = SixHourForecast(
        grid_id="GRID-TEST-DELHI",
        latitude=28.6139,
        longitude=77.2090,
        forecast_generated_at=now.isoformat(),
        horizon_hours=6,
        event_start_estimate=event_start.isoformat(),
        lead_time_minutes=lead_time_minutes,
        lead_time_hours=round(lead_time_minutes / 60.0, 1),
        peak_severity=sev_enum,
        primary_hazard=haz_enum,
        peak_risk_score=0.92,
        confidence=0.88,
        affected_grid_cells=["GRID-TEST-DELHI", "GRID-TEST-NOIDA"],
        predictions=[
            HourlyPrediction(
                timestep=i,
                valid_time=(now + timedelta(hours=i)).isoformat(),
                lead_time_minutes=i * 60,
                thunderstorm_probability=0.85,
                hail_probability=0.45,
                cloudburst_probability=0.75,
                composite_risk_score=0.85,
                severity=sev_enum,
                confidence=0.88
            ) for i in range(7)
        ]
    )

    alert = await warning_engine.evaluate_forecast(
        forecast=synthetic_forecast,
        location_meta={"name": "Delhi-NCR Sector", "state": "Delhi"}
    )

    return {
        "status": "TEST_ALERT_ISSUED",
        "alert": alert
    }
