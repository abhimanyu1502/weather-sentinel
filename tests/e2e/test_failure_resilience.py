"""
Failure Resilience and Graceful Degradation Tests.
Complies with Section 11 and Section 46 of SIH 26084 PRD.
"""

import pytest
from app.ingestion.base import WeatherProvider
from app.ingestion.registry import ProviderRegistry
from app.processing.fusion import DataFusionEngine
from app.schemas.weather import NormalizedWeatherObservation
from datetime import datetime, timezone


class BrokenProvider(WeatherProvider):
    def __init__(self):
        super().__init__(name="broken_source", enabled=True, priority=1)

    async def fetch_current(self, location):
        raise ConnectionResetError("Remote API 500 / Network reset simulation")

    async def fetch_forecast(self, location):
        raise TimeoutError("API Gateway Timeout (504)")

    async def health_check(self):
        return {"provider": self.name, "status": "OFFLINE", "healthy": False}


class PartialProvider(WeatherProvider):
    def __init__(self):
        super().__init__(name="partial_source", enabled=True, priority=1)

    async def fetch_current(self, location):
        # Missing temperature, missing radar, but valid wind and humidity
        return NormalizedWeatherObservation(
            source=self.name,
            source_timestamp=datetime.now(timezone.utc),
            latitude=location["lat"],
            longitude=location["lon"],
            relative_humidity=85.0,
            wind_speed_ms=14.0
        )

    async def fetch_forecast(self, location):
        return {}

    async def health_check(self):
        return {"provider": self.name, "status": "OPERATIONAL", "healthy": True}


@pytest.mark.asyncio
async def test_single_provider_failure_does_not_crash_pipeline():
    reg = ProviderRegistry()
    reg.register(BrokenProvider())
    reg.register(PartialProvider())

    # Fetching from all enabled providers should gracefully catch the BrokenProvider error
    obs = await reg.fetch_all({"lat": 28.61, "lon": 77.21})
    assert len(obs) == 1
    assert obs[0].source == "partial_source"


def test_missing_data_fusion_graceful_handling():
    # Only partial data provided (missing temperature and radar)
    partial_obs = [
        NormalizedWeatherObservation(
            source="station_1",
            source_timestamp=datetime.now(timezone.utc),
            latitude=28.61,
            longitude=77.21,
            relative_humidity=80.0,
            wind_speed_ms=10.0
        )
    ]
    fusion = DataFusionEngine.fuse(partial_obs, 28.61, 77.21)
    fused = fusion["fused_observation"]
    assert fused is not None
    # Must NOT silently inject 0.0 for temperature or radar!
    assert fused.temperature_c is None
    assert fused.radar_reflectivity_dbz is None
    assert fused.relative_humidity == 80.0
    assert fusion["status"] == "FUSED"
