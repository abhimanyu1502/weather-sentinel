"""
Unit tests for AntiGravity Physics Engine & Convective Initiation Detector.
"""

import sys
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np
from pipelines.features.physics_features import detect_ci, compute_storm_params

def test_convective_initiation_detection():
    # Cold cloud top simulating rapid vertical updraft
    tir1_cur = np.ones((128, 128), dtype=np.float32) * 230.0
    tir1_prev = np.ones((128, 128), dtype=np.float32) * 242.0  # cooled by 12K in 10 min
    tir2_cur = np.ones((128, 128), dtype=np.float32) * 230.5  # SWD ~ -0.5K (ice glaciation)
    dbz = np.ones((128, 128), dtype=np.float32) * 45.0  # first echo > 35 dBZ

    status = detect_ci(tir1_cur, tir1_prev, tir2_cur, dbz, dt_min=10.0)

    assert status.is_detected == True
    assert status.confidence >= 0.8
    assert status.ctcr_k_per_15min <= -4.0
    print("✅ test_convective_initiation_detection passed!")

def test_severe_storm_parameters():
    dbz_patch = np.ones((16, 16), dtype=np.float32) * 62.0
    vel_patch = np.linspace(-15, 18, 256, dtype=np.float32).reshape((16, 16))
    tir1_patch = np.ones((16, 16), dtype=np.float32) * 215.0
    lightning_patch = np.ones((16, 16), dtype=np.float32) * 0.8

    params = compute_storm_params(dbz_patch, vel_patch, tir1_patch, lightning_patch, "CELL_TEST")

    assert params.max_dbz == 62.0
    assert params.is_cloudburst == True  # 62 dBZ -> rain rate > 100 mm/hr
    assert params.severity_level == "CRITICAL"
    assert params.hail_mesh_mm > 0.0
    assert params.downburst_gust_kmh > 40.0
    print("✅ test_severe_storm_parameters passed!")

if __name__ == "__main__":
    test_convective_initiation_detection()
    test_severe_storm_parameters()
