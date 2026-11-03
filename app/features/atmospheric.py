"""
Atmospheric Instability and Thermodynamic Feature Extraction.
Complies with Section 16 of SIH 26084 PRD.
"""

from typing import Dict, Any, Optional
import math
from app.schemas.weather import NormalizedWeatherObservation


class AtmosphericFeatureExtractor:
    """
    Computes thermodynamic and severe convective indices:
    CAPE, CIN, Lifted Index, K-Index, Total Totals, and Dew Point Depression.
    """

    @staticmethod
    def extract(obs: NormalizedWeatherObservation) -> Dict[str, Any]:
        temp = obs.temperature_c or 25.0
        dew = obs.dew_point_c or (temp - 5.0)
        rh = obs.relative_humidity or 70.0
        pressure = obs.surface_pressure_hpa or 1010.0
        cape = obs.cape_j_kg or 0.0

        # 1. Dew point depression (T - Td)
        dew_depression = max(0.0, temp - dew)

        # 2. Lifted Index proxy if not provided directly
        lifted_index = obs.lifted_index
        if lifted_index is None:
            # Empirical proxy: high CAPE -> negative LI
            if cape > 2500:
                lifted_index = -6.0
            elif cape > 1500:
                lifted_index = -3.5
            elif cape > 800:
                lifted_index = -1.5
            else:
                lifted_index = 2.0

        # 3. K-Index proxy (K = (T850 - T500) + Td850 - (T700 - Td700))
        # Parameterized based on surface instability & moisture
        k_index = round(20.0 + (dew * 0.6) + (cape / 250.0), 1)

        # 4. Total Totals (TT) Index proxy
        total_totals = round(40.0 + (cape / 200.0) - (dew_depression * 0.5), 1)

        # 5. Moist Convective Potential (MCP)
        mcp = round((cape / 2000.0) * (rh / 100.0), 2)

        return {
            "cape_j_kg": cape,
            "cin_j_kg": obs.cin_j_kg or 0.0,
            "lifted_index": round(lifted_index, 1),
            "dew_point_depression_c": round(dew_depression, 1),
            "k_index": k_index,
            "total_totals_index": total_totals,
            "moist_convective_potential": min(1.0, max(0.0, mcp)),
            "surface_pressure_hpa": pressure
        }
