"""
Unit Tests for 0–6 Hour Forecasting Horizon and Lead Time Calculation.
Complies with Section 3.1 of SIH 26084 PRD.
"""

from app.forecasting.baseline import ForecastGenerator


def test_forecast_seven_step_sequence():
    assessment = {
        "thunderstorm": {"risk": 0.75, "confidence": 0.85},
        "hail": {"risk": 0.40, "confidence": 0.80},
        "cloudburst": {"risk": 0.70, "confidence": 0.85}
    }
    features = {
        "atmospheric": {"cape_j_kg": 2200.0},
        "radar": {"max_reflectivity_dbz": 52.0},
        "precipitation": {"rain_rate_mm_h": 45.0}
    }

    forecast = ForecastGenerator.generate_6h_forecast(
        current_assessment=assessment,
        features=features,
        lat=28.6139,
        lon=77.2090,
        grid_id="GRID-TEST"
    )

    # 1. Exactly 7 hourly steps: T+0, T+1, T+2, T+3, T+4, T+5, T+6
    assert len(forecast.predictions) == 7
    timesteps = [p.timestep for p in forecast.predictions]
    assert timesteps == [0, 1, 2, 3, 4, 5, 6]

    # 2. Probability bounded [0, 1]
    for p in forecast.predictions:
        assert 0.0 <= p.thunderstorm_probability <= 1.0
        assert 0.0 <= p.hail_probability <= 1.0
        assert 0.0 <= p.cloudburst_probability <= 1.0
        assert 0.0 <= p.confidence <= 1.0

    # 3. Forecast metadata present
    assert forecast.forecast_generated_at is not None
    assert forecast.horizon_hours == 6
    assert forecast.grid_id == "GRID-TEST"
