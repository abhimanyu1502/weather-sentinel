"""
Pydantic schemas for hazard assessment: Thunderstorm, Hail, Cloudburst.
Complies with Section 17 & 18 of SIH 26084 PRD.
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class HazardType(str, Enum):
    THUNDERSTORM = "thunderstorm"
    HAIL = "hail"
    CLOUDBURST = "cloudburst"


class SeverityLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    SEVERE = "SEVERE"


class HazardEvaluation(BaseModel):
    hazard: HazardType
    risk: float = Field(..., ge=0.0, le=1.0, description="Risk probability score [0.0 - 1.0]")
    severity: SeverityLevel
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in assessment [0.0 - 1.0]")
    triggers: List[str] = Field(default_factory=list, description="List of physical indices triggering this hazard")
    evidence: Dict[str, Any] = Field(default_factory=dict, description="Raw physical metrics supporting this evaluation")


class MultiHazardAssessment(BaseModel):
    timestamp: str
    grid_id: Optional[str] = None
    location: Dict[str, float]
    thunderstorm: HazardEvaluation
    hail: HazardEvaluation
    cloudburst: HazardEvaluation
    overall_severity: SeverityLevel
    max_risk_score: float
    recommended_actions: List[str]
