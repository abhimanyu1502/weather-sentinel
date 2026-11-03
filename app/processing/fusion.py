"""
Spatio-Temporal Multi-Source Meteorological Data Fusion Strategy.
Complies with Section 54 of SIH 26084 PRD.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import numpy as np
from app.schemas.weather import NormalizedWeatherObservation


class DataFusionEngine:
    """
    Fuses heterogeneous observations into a canonical fused state.
    Calculates dynamic source quality weights based on reliability, freshness,
    resolution, and cross-source agreement.
    """

    SOURCE_BASE_RELIABILITY = {
        "radar_dwr_composite": 0.96,
        "lightning_damini_lls": 0.94,
        "source_a_open_meteo": 0.91,
        "satellite_insat_3dr": 0.88,
        "source_b_imd_synoptic": 0.85,
        "demo_synthetic_storm": 1.00
    }

    @classmethod
    def fuse(
        cls,
        observations: List[NormalizedWeatherObservation],
        target_lat: float,
        target_lon: float
    ) -> Dict[str, Any]:
        if not observations:
            return {
                "fused_observation": None,
                "fusion_confidence": 0.0,
                "source_weights": {},
                "status": "NO_OBSERVATIONS"
            }

        now = datetime.now(timezone.utc)
        weighted_scores = {}
        total_weight = 0.0

        # Calculate individual source weights
        for obs in observations:
            base_rel = cls.SOURCE_BASE_RELIABILITY.get(obs.source, 0.80)
            # Freshness decay factor (0 to 1)
            t = obs.source_timestamp
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            age_min = max(0.0, (now - t).total_seconds() / 60.0)
            freshness = max(0.2, 1.0 - (age_min / 60.0))

            # Quality factor from validator
            qc_factor = obs.data_quality_score

            weight = base_rel * freshness * qc_factor
            weighted_scores[obs.source] = round(weight, 3)
            total_weight += weight

        # Normalize weights
        norm_weights = {
            src: (w / total_weight if total_weight > 0 else 1.0 / len(observations))
            for src, w in weighted_scores.items()
        }

        # Weighted fusion of numerical variables
        def _fuse_val(attr_name: str) -> Optional[float]:
            vals = []
            w_sum = 0.0
            for obs in observations:
                val = getattr(obs, attr_name)
                if val is not None:
                    w = norm_weights[obs.source]
                    vals.append(val * w)
                    w_sum += w
            if w_sum > 0:
                return round(sum(vals) / w_sum, 2)
            return None

        # Max reflectivity and max lightning should prefer peak convective values rather than dilution
        all_dbz = [o.radar_reflectivity_dbz for o in observations if o.radar_reflectivity_dbz is not None]
        peak_dbz = max(all_dbz) if all_dbz else _fuse_val("radar_reflectivity_dbz")

        all_light = [o.lightning_count for o in observations if o.lightning_count is not None]
        peak_lightning = max(all_light) if all_light else 0

        all_cape = [o.cape_j_kg for o in observations if o.cape_j_kg is not None]
        peak_cape = max(all_cape) if all_cape else _fuse_val("cape_j_kg")

        fused = NormalizedWeatherObservation(
            source="fused_multi_source_composite",
            source_timestamp=now,
            latitude=target_lat,
            longitude=target_lon,
            temperature_c=_fuse_val("temperature_c"),
            dew_point_c=_fuse_val("dew_point_c"),
            relative_humidity=_fuse_val("relative_humidity"),
            surface_pressure_hpa=_fuse_val("surface_pressure_hpa"),
            wind_speed_ms=_fuse_val("wind_speed_ms"),
            wind_direction_deg=_fuse_val("wind_direction_deg"),
            wind_gust_ms=_fuse_val("wind_gust_ms"),
            precipitation_mm=_fuse_val("precipitation_mm"),
            precipitation_rate_mm_h=_fuse_val("precipitation_rate_mm_h"),
            cloud_cover_pct=_fuse_val("cloud_cover_pct"),
            lightning_count=peak_lightning,
            radar_reflectivity_dbz=peak_dbz,
            radar_velocity_ms=_fuse_val("radar_velocity_ms"),
            satellite_cloud_top_temperature_c=_fuse_val("satellite_cloud_top_temperature_c"),
            cape_j_kg=peak_cape,
            cin_j_kg=_fuse_val("cin_j_kg"),
            lifted_index=_fuse_val("lifted_index"),
            vertical_wind_shear=_fuse_val("vertical_wind_shear"),
            data_quality_score=round(sum(o.data_quality_score for o in observations) / len(observations), 2)
        )

        # Cross-source agreement factor
        agreement = 1.0
        if len(observations) >= 2:
            temps = [o.temperature_c for o in observations if o.temperature_c is not None]
            if len(temps) >= 2 and np.std(temps) > 5.0:
                agreement -= 0.15  # Disagreement penalty

        fusion_confidence = min(1.0, max(0.1, round(np.mean(list(norm_weights.values())) * agreement * 1.5, 2)))

        return {
            "fused_observation": fused,
            "fusion_confidence": fusion_confidence,
            "source_weights": norm_weights,
            "sources_count": len(observations),
            "status": "FUSED"
        }
