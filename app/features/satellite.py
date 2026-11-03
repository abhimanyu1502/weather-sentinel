"""
Satellite Feature Extractor.
Complies with Section 16 of SIH 26084 PRD.
"""

from typing import Dict, Any
from app.schemas.weather import NormalizedWeatherObservation


class SatelliteFeatureExtractor:
    @staticmethod
    def extract(obs: NormalizedWeatherObservation) -> Dict[str, Any]:
        ctt = obs.satellite_cloud_top_temperature_c or -10.0

        # Rapid cloud-top cooling rate (CTCR): proxy for overshooting tops
        cooling_intensity = 0.0
        if ctt < -40.0:
            cooling_intensity = min(1.0, round(abs(ctt + 40.0) / 40.0, 2))

        return {
            "cloud_top_temp_c": ctt,
            "cooling_intensity_score": cooling_intensity,
            "overshooting_top_detected": ctt <= -65.0,
            "satellite_hazard_score": cooling_intensity
        }
