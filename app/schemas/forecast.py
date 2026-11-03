"""
Pydantic schemas for rolling 0–6 hour convective hazard forecasts.
Complies with Section 3.1 and Section 19 of SIH 26084 PRD.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.hazard import SeverityLevel, HazardType


class HourlyPrediction(BaseModel):
    timestep: int = Field(..., ge=0, le=6, description="Forecast step T+0 to T+6 hours")
    valid_time: str = Field(..., description="Target UTC timestamp for this prediction step")
    lead_time_minutes: int = Field(..., ge=0, description="Lead time in minutes from generation")
    thunderstorm_probability: float = Field(..., ge=0.0, le=1.0)
    hail_probability: float = Field(..., ge=0.0, le=1.0)
    cloudburst_probability: float = Field(..., ge=0.0, le=1.0)
    composite_risk_score: float = Field(..., ge=0.0, le=1.0)
    severity: SeverityLevel
    confidence: float = Field(..., ge=0.0, le=1.0)
    expected_rain_rate_mm_h: float = Field(0.0, ge=0.0)
    expected_radar_dbz: float = Field(0.0, ge=0.0)


class SixHourForecast(BaseModel):
    grid_id: str
    latitude: float
    longitude: float
    forecast_generated_at: str
    horizon_hours: int = 6
    event_start_estimate: Optional[str] = None
    lead_time_minutes: Optional[int] = None
    lead_time_hours: Optional[float] = None
    peak_severity: SeverityLevel
    primary_hazard: Optional[HazardType] = None
    peak_risk_score: float
    confidence: float
    affected_grid_cells: List[str] = Field(default_factory=list)
    predictions: List[HourlyPrediction] = Field(
        ...,
        description="Exact 7-step sequence for T+0, T+1, T+2, T+3, T+4, T+5, T+6 hours"
    )
    explanation: Dict[str, Any] = Field(default_factory=dict)
