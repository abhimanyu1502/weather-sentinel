"""
Pydantic schemas for early warnings, alerts and notification payloads.
Complies with Section 20 & 21 of SIH 26084 PRD.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.schemas.hazard import SeverityLevel, HazardType


class AlertObject(BaseModel):
    alert_id: str = Field(..., description="Unique alert identifier e.g. ALT-2026-000001")
    hazard: HazardType
    severity: SeverityLevel
    issued_at: str
    event_start: str
    lead_time_minutes: int = Field(..., ge=0, description="Measured actionable warning lead time")
    lead_time_hours: float
    confidence: float = Field(..., ge=0.0, le=1.0)
    risk_score: float = Field(..., ge=0.0, le=1.0)
    affected_area: Dict[str, Any] = Field(
        ...,
        description="GeoJSON polygon, circle or centroid bounding box of impact zone"
    )
    reasons: List[str] = Field(..., description="Explainable meteorological triggers")
    recommended_actions: List[str] = Field(..., description="Public safety directives")
    status: str = Field("ACTIVE", description="ACTIVE | ESCALATED | DE-ESCALATED | EXPIRED | CANCELLED")


class AlertHistoryItem(BaseModel):
    alert: AlertObject
    sent_channels: List[str]
    delivery_status: Dict[str, str]
    created_at: str
