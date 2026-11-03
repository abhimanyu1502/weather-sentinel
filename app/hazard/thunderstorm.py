"""
Thunderstorm Risk Assessment Module.
Complies with Section 17 & 18 of SIH 26084 PRD.
"""

from typing import Dict, Any, List
from app.schemas.hazard import HazardType, HazardEvaluation
from app.hazard.thresholds import HazardThresholds
from app.hazard.confidence import ConfidenceModel


class ThunderstormRiskEvaluator:
    """
    Evaluates thunderstorm probability, severity, confidence and triggers from:
    CAPE, CIN, Lifted Index, radar reflectivity, lightning rate, and satellite cooling.
    """

    @classmethod
    def evaluate(cls, features: Dict[str, Any], qc_score: float = 1.0, sources_count: int = 1) -> HazardEvaluation:
        atm = features.get("atmospheric", {})
        rad = features.get("radar", {})
        ltg = features.get("lightning", {})
        sat = features.get("satellite", {})
        prc = features.get("precipitation", {})

        triggers: List[str] = []

        # 1. Atmospheric instability score (0 to 1)
        cape = atm.get("cape_j_kg", 0.0)
        li = atm.get("lifted_index", 2.0)
        atm_score = min(1.0, max(0.0, cape / 2800.0))
        if cape >= HazardThresholds.THUNDERSTORM_MIN_CAPE_J_KG:
            triggers.append(f"Elevated CAPE: {cape:.0f} J/kg")
        if li <= -2.0:
            triggers.append(f"Unstable Lifted Index: {li}")

        # 2. Radar core score (0 to 1)
        dbz = rad.get("max_reflectivity_dbz", 0.0)
        rad_score = min(1.0, max(0.0, (dbz - 20.0) / 45.0))
        if dbz >= HazardThresholds.THUNDERSTORM_MIN_DBZ:
            triggers.append(f"Convective radar core: {dbz:.1f} dBZ")

        # 3. Lightning flash rate score (0 to 1)
        flashes = ltg.get("lightning_flash_count", 0)
        ltg_score = min(1.0, max(0.0, flashes / 30.0))
        if flashes >= HazardThresholds.THUNDERSTORM_LIGHTNING_THRESHOLD:
            triggers.append(f"Intense lightning activity: {flashes} strokes/cell")

        # 4. Satellite cooling rate score
        sat_score = sat.get("cooling_intensity_score", 0.0)
        if sat.get("overshooting_top_detected"):
            triggers.append("Severe overshooting cloud top (CTT <= -65°C)")

        # 5. Precipitation score
        prc_score = prc.get("precipitation_intensity_score", 0.0)

        # Multi-component weighted baseline (Section 18)
        # Weights: ATM(0.25) + RAD(0.30) + LTG(0.25) + SAT(0.10) + PRC(0.10)
        risk = (
            0.25 * atm_score +
            0.30 * rad_score +
            0.25 * ltg_score +
            0.10 * sat_score +
            0.10 * prc_score
        )
        risk = min(1.0, max(0.0, round(risk, 2)))
        severity = HazardThresholds.get_severity(risk)
        confidence = ConfidenceModel.calculate(features, qc_score, sources_count)

        return HazardEvaluation(
            hazard=HazardType.THUNDERSTORM,
            risk=risk,
            severity=severity,
            confidence=confidence,
            triggers=triggers if triggers else ["Normal convective background"],
            evidence={
                "cape_j_kg": cape,
                "dbz": dbz,
                "lightning_count": flashes,
                "cloud_top_temp_c": sat.get("cloud_top_temp_c")
            }
        )
