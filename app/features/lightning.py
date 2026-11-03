"""
Lightning Feature Extractor.
Complies with Section 16 of SIH 26084 PRD.
"""

from typing import Dict, Any
from app.schemas.weather import NormalizedWeatherObservation


class LightningFeatureExtractor:
    @staticmethod
    def extract(obs: NormalizedWeatherObservation) -> Dict[str, Any]:
        count = obs.lightning_count or 0
        density_per_km2 = round(count / 25.0, 3)  # Approx 5km radius cell
        activity_level = "LOW"
        if count >= 30:
            activity_level = "EXTREME"
        elif count >= 15:
            activity_level = "HIGH"
        elif count >= 5:
            activity_level = "MODERATE"

        return {
            "lightning_flash_count": count,
            "lightning_density_per_km2": density_per_km2,
            "lightning_activity_level": activity_level,
            "lightning_hazard_score": min(1.0, round(count / 40.0, 2))
        }
