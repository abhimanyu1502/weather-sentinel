"""
Deterministic Demo Weather Provider for Hackathon Evaluation.
Complies with Section 32 & 39 of SIH 26084 PRD.
Guarantees a fully demonstrable, reproducible 0–6 hour severe convective storm event.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from app.ingestion.base import WeatherProvider
from app.schemas.weather import NormalizedWeatherObservation
from app.ingestion.validator import ObservationValidator


class DemoWeatherProvider(WeatherProvider):
    """
    Simulates a developing severe convective storm cycle over 6 hours:
    At T-6h: Convective initiation, CAPE rising, lightning starts
    At T-3h: Radar core developing, hail signature appearing
    At T0: Severe cloudburst (>110 mm/h), microburst downburst, MESH > 35mm
    """

    def __init__(self, enabled: bool = True):
        super().__init__(name="demo_synthetic_storm", enabled=enabled, priority=0, reliability=1.0)
        self.stage: int = 0  # 0 to 6 representing lead-time steps

    def set_stage(self, stage: int):
        self.stage = max(0, min(6, stage))

    async def fetch_current(self, location: Dict[str, float]) -> NormalizedWeatherObservation:
        lat = location.get("lat", 28.6139)
        lon = location.get("lon", 77.2090)
        now = datetime.now(timezone.utc)

        # Interpolate intensity based on demo stage
        # Stage 0: T-6h pre-storm instability; Stage 6: peak storm
        s = self.stage
        temp = 34.0 - (s * 1.5)
        dew_point = 26.0 + (s * 0.4)
        cape = 1800.0 + (s * 450.0)
        dbz = 20.0 + (s * 8.5)          # from 20 dBZ to ~71 dBZ
        rain_rate = 0.0 if s < 2 else (s - 1) * 22.0  # reaches >110 mm/h
        gust_ms = 8.0 + (s * 4.2)       # reaches >33 m/s (~120 km/h)
        lightning = s * 18
        satellite_c = -20.0 - (s * 10.0) # cooling down to -80C

        obs = NormalizedWeatherObservation(
            source=self.name,
            source_timestamp=now,
            latitude=lat,
            longitude=lon,
            temperature_c=round(temp, 1),
            dew_point_c=round(dew_point, 1),
            relative_humidity=round(min(98.0, 60.0 + s * 6.0), 1),
            surface_pressure_hpa=round(1008.0 - s * 2.0, 1),
            wind_speed_ms=round(gust_ms * 0.5, 1),
            wind_direction_deg=270.0,
            wind_gust_ms=round(gust_ms, 1),
            precipitation_mm=round(rain_rate * 0.5, 1),
            precipitation_rate_mm_h=round(rain_rate, 1),
            cloud_cover_pct=min(100.0, 50.0 + s * 9.0),
            lightning_count=lightning,
            radar_reflectivity_dbz=round(dbz, 1),
            radar_velocity_ms=round(gust_ms * 0.8, 1),
            satellite_cloud_top_temperature_c=round(satellite_c, 1),
            cape_j_kg=round(cape, 1),
            cin_j_kg=max(0.0, 120.0 - s * 20.0),
            lifted_index=round(-2.0 - s * 1.5, 1),
            vertical_wind_shear=round(12.0 + s * 4.0, 1)
        )

        status, score, errors = ObservationValidator.validate(obs)
        obs.quality_status = status
        obs.data_quality_score = score
        obs.validation_errors = errors
        self.mark_success()
        return obs

    async def fetch_forecast(self, location: Dict[str, float]) -> Dict[str, Any]:
        return {
            "source": self.name,
            "demo_scenario": "Severe Himalayan / Coastal Supercell",
            "horizon_hours": 6,
            "active_stage": self.stage
        }

    async def health_check(self) -> Dict[str, Any]:
        self.mark_success()
        return {
            "provider": self.name,
            "status": "OPERATIONAL",
            "healthy": True,
            "mode": "DETERMINISTIC_DEMO"
        }
