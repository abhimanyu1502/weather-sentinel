"""
Early Warning Lead Time Verification Tests.
Complies with Section 43 of SIH 26084 PRD.
"""

import pytest
from datetime import datetime, timezone, timedelta
from app.schemas.forecast import SixHourForecast, HourlyPrediction
from app.schemas.hazard import SeverityLevel, HazardType
from app.alerts.engine import WarningEngine


@pytest.mark.asyncio
async def test_six_hour_actionable_warning_lead_time():
    engine = WarningEngine()
    now = datetime.now(timezone.utc)
    target_event_time = now + timedelta(hours=6)

    # Synthetic forecast with event onset at T+6h (360 min lead)
    forecast = SixHourForecast(
        grid_id="GRID-LEAD-6H",
        latitude=28.61,
        longitude=77.21,
        forecast_generated_at=now.isoformat(),
        horizon_hours=6,
        event_start_estimate=target_event_time.isoformat(),
        lead_time_minutes=360,
        lead_time_hours=6.0,
        peak_severity=SeverityLevel.SEVERE,
        primary_hazard=HazardType.THUNDERSTORM,
        peak_risk_score=0.91,
        confidence=0.86,
        affected_grid_cells=["GRID-LEAD-6H"],
        predictions=[
            HourlyPrediction(
                timestep=i,
                valid_time=(now + timedelta(hours=i)).isoformat(),
                lead_time_minutes=i * 60,
                thunderstorm_probability=0.20 + (i * 0.12),
                hail_probability=0.10,
                cloudburst_probability=0.10,
                composite_risk_score=0.20 + (i * 0.12),
                severity=SeverityLevel.SEVERE if i == 6 else SeverityLevel.MODERATE,
                confidence=0.86
            ) for i in range(7)
        ]
    )

    alert = await engine.evaluate_forecast(forecast)
    assert alert is not None
    assert alert.lead_time_minutes == 360
    assert alert.lead_time_hours == 6.0
    assert alert.severity == SeverityLevel.SEVERE
    assert alert.hazard == HazardType.THUNDERSTORM


@pytest.mark.asyncio
async def test_short_lead_time_behavior():
    engine = WarningEngine()
    now = datetime.now(timezone.utc)

    # 30 minutes lead time (below standard 60m min lead)
    forecast = SixHourForecast(
        grid_id="GRID-LEAD-30M",
        latitude=19.07,
        longitude=72.87,
        forecast_generated_at=now.isoformat(),
        horizon_hours=6,
        event_start_estimate=(now + timedelta(minutes=30)).isoformat(),
        lead_time_minutes=30,
        lead_time_hours=0.5,
        peak_severity=SeverityLevel.SEVERE,
        primary_hazard=HazardType.CLOUDBURST,
        peak_risk_score=0.94,
        confidence=0.89,
        affected_grid_cells=["GRID-LEAD-30M"],
        predictions=[
            HourlyPrediction(
                timestep=0,
                valid_time=now.isoformat(),
                lead_time_minutes=0,
                thunderstorm_probability=0.5,
                hail_probability=0.2,
                cloudburst_probability=0.94,
                composite_risk_score=0.94,
                severity=SeverityLevel.SEVERE,
                confidence=0.89
            )
        ] + [
            HourlyPrediction(
                timestep=i,
                valid_time=(now + timedelta(hours=i)).isoformat(),
                lead_time_minutes=i * 60,
                thunderstorm_probability=0.4,
                hail_probability=0.1,
                cloudburst_probability=0.5,
                composite_risk_score=0.5,
                severity=SeverityLevel.MODERATE,
                confidence=0.80
            ) for i in range(1, 7)
        ]
    )

    alert = await engine.evaluate_forecast(forecast)
    assert alert is not None
    # Flash warning emitted due to high severity imminent threat
    assert alert.lead_time_minutes == 30
