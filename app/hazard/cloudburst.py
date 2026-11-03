"""
Cloudburst and Extreme Localized Deluge Risk Evaluator.
Complies with Section 17 & 18 of SIH 26084 PRD and IMD Cloudburst Standards.
"""

from typing import Dict, Any, List
from app.schemas.hazard import HazardType, HazardEvaluation
from app.hazard.thresholds import HazardThresholds
from app.hazard.confidence import ConfidenceModel


class CloudburstRiskEvaluator:
    @classmethod
    def evaluate(cls, features: Dict[str, Any], qc_score: float = 1.0, sources_count: int = 1) -> HazardEvaluation:
        prc = features.get("precipitation", {})
        rad = features.get("radar", {})
        atm = features.get("atmospheric", {})

        triggers: List[str] = []

        rain_rate = prc.get("rain_rate_mm_h", 0.0)
        accum_1h = prc.get("accum_1h_mm", 0.0)
        dbz = rad.get("max_reflectivity_dbz", 0.0)
        mcp = atm.get("moist_convective_potential", 0.5)

        # 1. Direct rain rate intensity score
        # IMD official cloudburst threshold: >= 100 mm/h
        rain_score = min(1.0, max(0.0, rain_rate / HazardThresholds.CLOUDBURST_RAIN_RATE_SEVERE_MM_H))
        if rain_rate >= HazardThresholds.CLOUDBURST_RAIN_RATE_SEVERE_MM_H:
            triggers.append(f"Official IMD Cloudburst criteria breached: {rain_rate:.1f} mm/h")
        elif rain_rate >= HazardThresholds.CLOUDBURST_HIGH_RAIN_RATE_MM_H:
            triggers.append(f"Torrential deluge approaching cloudburst threshold: {rain_rate:.1f} mm/h")

        # 2. Radar deep convective rain core (dBZ >= 52)
        rad_score = min(1.0, max(0.0, (dbz - 38.0) / 25.0))
        if dbz >= 52.0:
            triggers.append(f"Hyper-dense radar reflectivity core: {dbz:.1f} dBZ")

        # 3. Moisture convergence & potential
        moisture_score = mcp

        # Composite cloudburst score
        risk = (0.55 * rain_score) + (0.30 * rad_score) + (0.15 * moisture_score)
        risk = min(1.0, max(0.0, round(risk, 2)))
        severity = HazardThresholds.get_severity(risk)
        confidence = ConfidenceModel.calculate(features, qc_score, sources_count)

        return HazardEvaluation(
            hazard=HazardType.CLOUDBURST,
            risk=risk,
            severity=severity,
            confidence=confidence,
            triggers=triggers if triggers else ["Normal precipitation rate (<50 mm/h)"],
            evidence={
                "rain_rate_mm_h": rain_rate,
                "accum_1h_mm": accum_1h,
                "dbz": dbz,
                "moisture_convective_potential": round(mcp, 2)
            }
        )
