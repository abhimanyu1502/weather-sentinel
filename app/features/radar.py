"""
Radar Feature Extractor: MESH, POSH, reflectivity, downburst proxy.
Complies with Section 16 of SIH 26084 PRD.
"""

import math
from typing import Dict, Any
from app.schemas.weather import NormalizedWeatherObservation


class RadarFeatureExtractor:
    @staticmethod
    def extract(obs: NormalizedWeatherObservation) -> Dict[str, Any]:
        dbz = obs.radar_reflectivity_dbz or 0.0
        vel = obs.radar_velocity_ms or 0.0

        # Maximum Expected Size of Hail (MESH) proxy: (dBZ - 49) * 1.5 if dBZ > 49
        mesh_mm = 0.0
        posh_pct = 0.0
        if dbz > 49.0:
            mesh_mm = round((dbz - 49.0) * 1.5, 1)
            # POSH formula: Probability of Severe Hail (%)
            posh_pct = min(100.0, round(29.0 * math.log(2.54 * math.sqrt(mesh_mm**2 / 2.6 + 2.6) + 1.0), 1))

        # Downburst gust proxy from radial velocity convergence
        downburst_gust_kmh = round(vel * 3.6 + (dbz * 0.4), 1)

        return {
            "max_reflectivity_dbz": dbz,
            "radial_velocity_ms": vel,
            "hail_mesh_mm": mesh_mm,
            "hail_posh_pct": posh_pct,
            "downburst_gust_kmh": downburst_gust_kmh,
            "is_severe_echo": dbz >= 50.0,
            "radar_convective_score": min(1.0, max(0.0, round((dbz - 20.0) / 45.0, 3)))
        }
