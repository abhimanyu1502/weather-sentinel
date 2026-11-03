"""
Unified Feature Extraction Pipeline.
Integrates Atmospheric, Precipitation, Lightning, Radar, and Satellite feature extractors.
Complies with Section 16 of SIH 26084 PRD.
"""

from typing import Dict, Any
from app.schemas.weather import NormalizedWeatherObservation
from app.features.atmospheric import AtmosphericFeatureExtractor
from app.features.precipitation import PrecipitationFeatureExtractor
from app.features.lightning import LightningFeatureExtractor
from app.features.radar import RadarFeatureExtractor
from app.features.satellite import SatelliteFeatureExtractor


class FeaturePipeline:
    """
    Executes all physical feature extraction modules on a normalized/fused observation.
    Returns a unified meteorological feature dictionary.
    """

    @classmethod
    def extract_features(cls, obs: NormalizedWeatherObservation) -> Dict[str, Any]:
        features: Dict[str, Any] = {
            "source": obs.source,
            "timestamp": obs.source_timestamp.isoformat(),
            "latitude": obs.latitude,
            "longitude": obs.longitude,
            "quality_score": obs.data_quality_score,
            "atmospheric": AtmosphericFeatureExtractor.extract(obs),
            "precipitation": PrecipitationFeatureExtractor.extract(obs),
            "lightning": LightningFeatureExtractor.extract(obs),
            "radar": RadarFeatureExtractor.extract(obs),
            "satellite": SatelliteFeatureExtractor.extract(obs)
        }
        return features
