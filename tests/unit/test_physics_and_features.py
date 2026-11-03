"""
Unit Tests for Physics, Plausibility Validator, and Feature Extraction.
"""

import pytest
from datetime import datetime, timezone
from app.schemas.weather import NormalizedWeatherObservation
from app.ingestion.validator import ObservationValidator
from app.features.atmospheric import AtmosphericFeatureExtractor
from app.features.precipitation import PrecipitationFeatureExtractor
from app.features.radar import RadarFeatureExtractor


def test_observation_validator_bounds():
    # Valid observation
    obs = NormalizedWeatherObservation(
        source="test_sensor",
        source_timestamp=datetime.now(timezone.utc),
        latitude=28.6139,
        longitude=77.2090,
        temperature_c=32.5,
        relative_humidity=65.0,
        wind_speed_ms=12.0,
        precipitation_rate_mm_h=15.0
    )
    status, score, errors = ObservationValidator.validate(obs)
    assert status == "PASSED"
    assert score >= 0.8
    assert len(errors) == 0

    # Physical bounds violation (e.g. 58°C in India is physically implausible)
    obs_invalid = NormalizedWeatherObservation(
        source="test_sensor",
        source_timestamp=datetime.now(timezone.utc),
        latitude=28.6139,
        longitude=77.2090,
        temperature_c=58.5,
        wind_speed_ms=25.0,
        wind_gust_ms=10.0  # Gust lower than sustained wind
    )
    status_inv, score_inv, errors_inv = ObservationValidator.validate(obs_invalid)
    assert status_inv in ["FLAGGED", "REJECTED"]
    assert any("temperature" in e.lower() for e in errors_inv)
    assert any("gust" in e.lower() for e in errors_inv)


def test_atmospheric_feature_extractor():
    obs = NormalizedWeatherObservation(
        source="test",
        source_timestamp=datetime.now(timezone.utc),
        latitude=28.61,
        longitude=77.21,
        temperature_c=35.0,
        dew_point_c=25.0,
        relative_humidity=60.0,
        cape_j_kg=2800.0
    )
    atm = AtmosphericFeatureExtractor.extract(obs)
    assert atm["cape_j_kg"] == 2800.0
    assert atm["dew_point_depression_c"] == 10.0
    assert atm["lifted_index"] < 0  # Severe convective instability
    assert atm["moist_convective_potential"] > 0.5


def test_radar_and_hail_mesh():
    obs = NormalizedWeatherObservation(
        source="test",
        source_timestamp=datetime.now(timezone.utc),
        latitude=28.61,
        longitude=77.21,
        radar_reflectivity_dbz=55.0,
        radar_velocity_ms=25.0
    )
    rad = RadarFeatureExtractor.extract(obs)
    assert rad["max_reflectivity_dbz"] == 55.0
    assert rad["hail_mesh_mm"] > 5.0  # MESH formula triggers above 49 dBZ
    assert rad["hail_posh_pct"] > 40.0
    assert rad["is_severe_echo"] is True
