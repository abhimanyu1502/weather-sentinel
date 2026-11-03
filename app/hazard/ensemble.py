"""
Ensemble Hazard Assessment Engine.
Integrates Thunderstorm, Hail, and Cloudburst evaluations.
Complies with Section 17 & 18 of SIH 26084 PRD.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List
from app.schemas.hazard import (
    MultiHazardAssessment,
    SeverityLevel,
    HazardType,
    HazardEvaluation
)
from app.hazard.thunderstorm import ThunderstormRiskEvaluator
from app.hazard.hail import HailRiskEvaluator
from app.hazard.cloudburst import CloudburstRiskEvaluator
from app.hazard.thresholds import HazardThresholds


class HazardEnsembleEngine:
    @classmethod
    def evaluate(
        cls,
        features: Dict[str, Any],
        location: Dict[str, float],
        grid_id: str = "GRID-TARGET",
        qc_score: float = 1.0,
        sources_count: int = 1
    ) -> MultiHazardAssessment:
        tstorm_eval = ThunderstormRiskEvaluator.evaluate(features, qc_score, sources_count)
        hail_eval = HailRiskEvaluator.evaluate(features, qc_score, sources_count)
        burst_eval = CloudburstRiskEvaluator.evaluate(features, qc_score, sources_count)

        # Determine overall max risk and severity
        max_risk = max(tstorm_eval.risk, hail_eval.risk, burst_eval.risk)
        overall_severity = HazardThresholds.get_severity(max_risk)

        # Generate actionable public directives
        actions: List[str] = []
        if overall_severity in [SeverityLevel.HIGH, SeverityLevel.SEVERE]:
            if burst_eval.risk >= 0.5:
                actions.append("Flash flood alert: Move to higher ground; avoid low-lying drains and nullahs.")
            if hail_eval.risk >= 0.5:
                actions.append("Severe hail threat: Seek solid roof shelter; protect vehicles and livestock.")
            if tstorm_eval.risk >= 0.5:
                actions.append("Severe lightning warning: Stay indoors; avoid open fields, tall trees, and metal structures.")
        else:
            actions.append("Monitor localized nowcast bulletins. Standard outdoor precautions apply.")

        return MultiHazardAssessment(
            timestamp=datetime.now(timezone.utc).isoformat(),
            grid_id=grid_id,
            location=location,
            thunderstorm=tstorm_eval,
            hail=hail_eval,
            cloudburst=burst_eval,
            overall_severity=overall_severity,
            max_risk_score=max_risk,
            recommended_actions=actions
        )
