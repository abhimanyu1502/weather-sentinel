"""
Quality Control Pipeline for multi-source observations.
Complies with Section 13 of SIH 26084 PRD.
"""

from typing import List, Dict, Any
from app.schemas.weather import NormalizedWeatherObservation
from app.ingestion.validator import ObservationValidator


class QualityControlEngine:
    @staticmethod
    def run_qc(obs: NormalizedWeatherObservation) -> NormalizedWeatherObservation:
        status, score, errors = ObservationValidator.validate(obs)
        obs.quality_status = status
        obs.data_quality_score = score
        obs.validation_errors = errors
        return obs

    @staticmethod
    def filter_usable(observations: List[NormalizedWeatherObservation]) -> List[NormalizedWeatherObservation]:
        """Discards REJECTED records while retaining PASSED and FLAGGED with confidence discount."""
        return [o for o in observations if o.quality_status != "REJECTED"]
