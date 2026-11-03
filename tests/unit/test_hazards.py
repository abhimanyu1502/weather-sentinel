"""
Unit Tests for Thunderstorm, Hail, and Cloudburst Hazard Engines.
"""

import pytest
from app.hazard.thunderstorm import ThunderstormRiskEvaluator
from app.hazard.hail import HailRiskEvaluator
from app.hazard.cloudburst import CloudburstRiskEvaluator
from app.schemas.hazard import SeverityLevel, HazardType


def test_thunderstorm_hazard_evaluation():
    features = {
        "atmospheric": {"cape_j_kg": 2600.0, "lifted_index": -5.0},
        "radar": {"max_reflectivity_dbz": 52.0},
        "lightning": {"lightning_flash_count": 25},
        "satellite": {"cooling_intensity_score": 0.8, "overshooting_top_detected": True},
        "precipitation": {"precipitation_intensity_score": 0.5}
    }
    evaluation = ThunderstormRiskEvaluator.evaluate(features)
    assert evaluation.hazard == HazardType.THUNDERSTORM
    assert evaluation.risk >= 0.70
    assert evaluation.severity in [SeverityLevel.HIGH, SeverityLevel.SEVERE]
    assert len(evaluation.triggers) >= 2


def test_cloudburst_imd_threshold():
    # 105 mm/h exceeds IMD 100 mm/h cloudburst criterion
    features = {
        "atmospheric": {"moist_convective_potential": 0.85},
        "radar": {"max_reflectivity_dbz": 56.0},
        "precipitation": {"rain_rate_mm_h": 105.0, "accum_1h_mm": 105.0}
    }
    evaluation = CloudburstRiskEvaluator.evaluate(features)
    assert evaluation.hazard == HazardType.CLOUDBURST
    assert evaluation.risk >= 0.75
    assert evaluation.severity == SeverityLevel.SEVERE
    assert any("cloudburst" in t.lower() for t in evaluation.triggers)


def test_hail_risk_evaluation():
    features = {
        "atmospheric": {"cape_j_kg": 2400.0},
        "radar": {"max_reflectivity_dbz": 54.0, "hail_mesh_mm": 28.0, "hail_posh_pct": 75.0}
    }
    evaluation = HailRiskEvaluator.evaluate(features)
    assert evaluation.hazard == HazardType.HAIL
    assert evaluation.risk >= 0.60
    assert evaluation.severity in [SeverityLevel.HIGH, SeverityLevel.SEVERE]
