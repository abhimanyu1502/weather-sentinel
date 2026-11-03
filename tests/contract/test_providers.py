"""
Contract Tests for WeatherProvider Adapters.
Complies with Section 9 & 10 of SIH 26084 PRD.
"""

import pytest
from app.ingestion.base import WeatherProvider
from app.ingestion.sources.demo_source import DemoWeatherProvider
from app.ingestion.sources.source_b import SourceBProvider
from app.ingestion.sources.radar import RadarProvider
from app.ingestion.sources.satellite import SatelliteProvider
from app.ingestion.sources.lightning import LightningProvider
from app.schemas.weather import NormalizedWeatherObservation


@pytest.mark.asyncio
async def test_provider_contract_compliance():
    providers = [
        DemoWeatherProvider(),
        SourceBProvider(),
        RadarProvider(),
        SatelliteProvider(),
        LightningProvider()
    ]
    test_loc = {"lat": 28.6139, "lon": 77.2090}

    for p in providers:
        assert isinstance(p, WeatherProvider)
        assert hasattr(p, "name")
        assert hasattr(p, "enabled")

        # 1. Test health check
        health = await p.health_check()
        assert "status" in health
        assert "healthy" in health

        # 2. Test fetch_current returns NormalizedWeatherObservation
        obs = await p.fetch_current(test_loc)
        assert isinstance(obs, NormalizedWeatherObservation)
        assert obs.source == p.name
        assert obs.latitude == test_loc["lat"]
        assert obs.longitude == test_loc["lon"]
        assert obs.data_quality_score >= 0.0
