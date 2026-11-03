"""
Missing Data Handler and Quality Control Processing.
Complies with Section 13 & 14 of SIH 26084 PRD.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from app.schemas.weather import NormalizedWeatherObservation


class MissingDataHandler:
    """
    Ensures missing fields are never silently replaced with zero.
    Provides explicit missing flags and scientifically sound default estimations.
    """

    @staticmethod
    def identify_gaps(obs: NormalizedWeatherObservation) -> Dict[str, bool]:
        critical_fields = [
            "temperature_c", "dew_point_c", "surface_pressure_hpa",
            "wind_speed_ms", "precipitation_rate_mm_h", "cape_j_kg",
            "radar_reflectivity_dbz", "lightning_count"
        ]
        return {f: (getattr(obs, f) is None) for f in critical_fields}

    @staticmethod
    def impute_thermodynamics(obs: NormalizedWeatherObservation) -> NormalizedWeatherObservation:
        """
        Calculates missing dew point or RH when companion variables exist.
        """
        # If RH and Temp exist but Dew Point is missing: Magnus approximation
        if obs.temperature_c is not None and obs.relative_humidity is not None and obs.dew_point_c is None:
            t = obs.temperature_c
            rh = max(1.0, min(100.0, obs.relative_humidity))
            b = 17.625
            c = 243.04
            gamma = math.log(rh / 100.0) + (b * t) / (c + t)
            obs.dew_point_c = round((c * gamma) / (b - gamma), 2)

        return obs


class QualityControlPipeline:
    """
    Aggregates validation across multiple observations, tracks quality degradation,
    and calculates cross-source credibility.
    """

    @staticmethod
    def evaluate_batch(observations: List[NormalizedWeatherObservation]) -> Dict[str, Any]:
        if not observations:
            return {"batch_status": "EMPTY", "mean_quality_score": 0.0}

        scores = [o.data_quality_score for o in observations]
        passed = sum(1 for o in observations if o.quality_status == "PASSED")
        flagged = sum(1 for o in observations if o.quality_status == "FLAGGED")
        rejected = sum(1 for o in observations if o.quality_status == "REJECTED")

        return {
            "batch_status": "HEALTHY" if rejected == 0 else "DEGRADED",
            "total_observations": len(observations),
            "passed": passed,
            "flagged": flagged,
            "rejected": rejected,
            "mean_quality_score": round(sum(scores) / len(scores), 2)
        }
