"""
Warning Rules and Early Warning Decision Logic.
Complies with Section 20 of SIH 26084 PRD.
"""

from typing import Tuple, List, Optional
from app.schemas.forecast import SixHourForecast
from app.schemas.hazard import SeverityLevel, HazardType
from app.core.config import settings


class WarningRules:
    # Minimum probability and confidence to issue actionable warning
    SEVERE_PROBABILITY_THRESHOLD = 0.65
    HIGH_PROBABILITY_THRESHOLD = 0.50
    MIN_CONFIDENCE_THRESHOLD = 0.55

    @classmethod
    def should_issue_warning(
        cls,
        forecast: SixHourForecast
    ) -> Tuple[bool, Optional[str], List[str]]:
        """
        Decision rule:
        IF severe_probability >= threshold
        AND confidence >= threshold
        AND lead_time >= minimum_lead
        THEN generate warning.
        """
        reasons = []

        # 1. Check peak risk & severity
        if forecast.peak_risk_score < cls.HIGH_PROBABILITY_THRESHOLD:
            return False, None, ["Peak risk below warning trigger threshold"]

        # 2. Check confidence
        if forecast.confidence < cls.MIN_CONFIDENCE_THRESHOLD:
            return False, None, [f"Confidence ({forecast.confidence:.2f}) below threshold ({cls.MIN_CONFIDENCE_THRESHOLD})"]

        # 3. Check actionable lead time
        lead_min = forecast.lead_time_minutes
        if lead_min is None:
            # If current T+0 condition is already SEVERE, immediate warning
            if forecast.peak_severity == SeverityLevel.SEVERE:
                reasons.append("Immediate severe convective hazard active at current timestep")
                return True, "IMMEDIATE_WARNING", reasons
            return False, None, ["No future severe onset timestep identified"]

        if lead_min < settings.MIN_WARNING_LEAD_MINUTES:
            reasons.append(f"Onset within {lead_min}m (below target lead of {settings.MIN_WARNING_LEAD_MINUTES}m, but immediate threat)")
            return True, "FLASH_WARNING", reasons

        reasons.append(f"Severe convective event projected with {lead_min} min ({forecast.lead_time_hours}h) actionable lead time")
        reasons.append(f"Peak risk probability {int(forecast.peak_risk_score * 100)}% with {int(forecast.confidence * 100)}% confidence")
        return True, "EARLY_WARNING", reasons
