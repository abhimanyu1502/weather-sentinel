"""
Precipitation feature extraction: rates, accumulation, and acceleration.
Complies with Section 16 of SIH 26084 PRD.
"""

from typing import Dict, Any, Optional
from app.schemas.weather import NormalizedWeatherObservation


class PrecipitationFeatureExtractor:
    """
    Computes precipitation rates, multi-hour accumulations, and Marshall-Palmer Z-R relations.
    """

    @staticmethod
    def extract(obs: NormalizedWeatherObservation) -> Dict[str, Any]:
        # Rain rate from direct observation or derived from radar reflectivity via Z = 300 * R^1.4
        rain_rate = obs.precipitation_rate_mm_h or 0.0

        if rain_rate == 0.0 and obs.radar_reflectivity_dbz is not None and obs.radar_reflectivity_dbz >= 20.0:
            z_linear = 10.0 ** (obs.radar_reflectivity_dbz / 10.0)
            rain_rate = round((z_linear / 300.0) ** (1.0 / 1.4), 2)

        # Multi-hour accumulation projections based on cell persistence
        accum_1h = round(rain_rate * 1.0, 1)
        accum_3h = round(rain_rate * 2.6, 1)
        accum_6h = round(rain_rate * 4.8, 1)

        # Cloudburst threshold flag: rain >= 100 mm/h (IMD standard)
        is_cloudburst_rate = rain_rate >= 100.0

        return {
            "rain_rate_mm_h": rain_rate,
            "accum_1h_mm": accum_1h,
            "accum_3h_mm": accum_3h,
            "accum_6h_mm": accum_6h,
            "is_cloudburst_rate": is_cloudburst_rate,
            "precipitation_intensity_score": min(1.0, round(rain_rate / 100.0, 3))
        }
