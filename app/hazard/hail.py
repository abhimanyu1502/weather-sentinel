"""
Hail Risk Assessment Module (MESH / POSH / Updraft proxies).
Complies with Section 17 & 18 of SIH 26084 PRD.
"""

from typing import Dict, Any, List
from app.schemas.hazard import HazardType, HazardEvaluation
from app.hazard.thresholds import HazardThresholds
from app.hazard.confidence import ConfidenceModel


class HailRiskEvaluator:
    @classmethod
    def evaluate(cls, features: Dict[str, Any], qc_score: float = 1.0, sources_count: int = 1) -> HazardEvaluation:
        rad = features.get("radar", {})
        atm = features.get("atmospheric", {})

        triggers: List[str] = []

        dbz = rad.get("max_reflectivity_dbz", 0.0)
        mesh_mm = rad.get("hail_mesh_mm", 0.0)
        posh_pct = rad.get("hail_posh_pct", 0.0)
        cape = atm.get("cape_j_kg", 0.0)

        # 1. MESH & POSH radar hail score
        posh_score = posh_pct / 100.0
        if mesh_mm >= HazardThresholds.HAIL_MESH_SEVERE_MM:
            triggers.append(f"Severe hail core MESH: {mesh_mm:.1f} mm")
        elif mesh_mm > 10.0:
            triggers.append(f"Hail core signature detected: {mesh_mm:.1f} mm")

        if posh_pct >= HazardThresholds.HAIL_POSH_SEVERE_PCT:
            triggers.append(f"High Probability of Severe Hail (POSH): {posh_pct:.0f}%")

        # 2. Strong updraft proxy (high CAPE + high dBZ)
        updraft_score = min(1.0, (cape / 3000.0) * (max(0.0, dbz - 35.0) / 30.0))
        if updraft_score >= 0.6:
            triggers.append("Vigorous convective updraft sustaining hail growth")

        # Composite hail risk score
        risk = (0.60 * posh_score) + (0.40 * updraft_score)
        risk = min(1.0, max(0.0, round(risk, 2)))
        severity = HazardThresholds.get_severity(risk)
        confidence = ConfidenceModel.calculate(features, qc_score, sources_count)

        return HazardEvaluation(
            hazard=HazardType.HAIL,
            risk=risk,
            severity=severity,
            confidence=confidence,
            triggers=triggers if triggers else ["Hail probability below detection threshold"],
            evidence={
                "mesh_mm": mesh_mm,
                "posh_pct": posh_pct,
                "updraft_score": round(updraft_score, 2),
                "cape_j_kg": cape
            }
        )
