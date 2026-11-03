"""
Configurable Meteorological Hazard Thresholds.
Complies with Section 18 of SIH 26084 PRD.
"""

from typing import Dict, Any
from app.schemas.hazard import SeverityLevel


class HazardThresholds:
    # Severity classification intervals [0.0 - 1.0]
    SEVERITY_LEVELS = [
        (0.00, 0.24, SeverityLevel.LOW),
        (0.25, 0.49, SeverityLevel.MODERATE),
        (0.50, 0.74, SeverityLevel.HIGH),
        (0.75, 1.00, SeverityLevel.SEVERE),
    ]

    # Convective hazard specific thresholds
    THUNDERSTORM_MIN_CAPE_J_KG = 1000.0
    THUNDERSTORM_SEVERE_CAPE_J_KG = 2200.0
    THUNDERSTORM_MIN_DBZ = 35.0
    THUNDERSTORM_SEVERE_DBZ = 50.0
    THUNDERSTORM_LIGHTNING_THRESHOLD = 8

    HAIL_MESH_SEVERE_MM = 25.0
    HAIL_POSH_SEVERE_PCT = 60.0
    HAIL_MIN_DBZ = 45.0

    CLOUDBURST_RAIN_RATE_SEVERE_MM_H = 100.0
    CLOUDBURST_HIGH_RAIN_RATE_MM_H = 65.0
    CLOUDBURST_MIN_ACCUM_1H_MM = 50.0

    DOWNBURST_GUST_SEVERE_KMH = 55.0

    @classmethod
    def get_severity(cls, score: float) -> SeverityLevel:
        s = max(0.0, min(1.0, score))
        for low, high, level in cls.SEVERITY_LEVELS:
            if low <= s <= high:
                return level
        return SeverityLevel.SEVERE
