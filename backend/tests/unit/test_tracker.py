"""
Unit tests for Storm Cell Segmentation, Tracking, and Landmark ETA Countdowns.
"""

import sys
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np
from pipelines.tracking.cell_tracker import StormCellTracker, haversine

def test_haversine_distance():
    # Mumbai Airport to Mantralaya (~18 km)
    dist = haversine(19.0896, 72.8656, 18.9322, 72.8333)
    assert 15.0 < dist < 25.0
    print(f"✅ test_haversine_distance passed! (Computed: {dist:.2f} km)")

def test_cell_segmentation_and_countdowns():
    tracker = StormCellTracker(min_lat=17.0, max_lat=22.0, min_lon=70.0, max_lon=77.0, grid_h=128, grid_w=128)
    tracker.load_landmarks([
        {"name": "Test Airport", "lat": 19.1, "lon": 72.9, "category": "Airport", "alert_radius_km": 15.0}
    ])

    dbz_grid = np.zeros((128, 128), dtype=np.float32)
    # Inject storm blob at row 60, col 60
    dbz_grid[55:65, 55:65] = 55.0

    candidates = tracker.segment(dbz_grid, threshold=38.0, min_area_km2=5.0)
    assert len(candidates) >= 1

    tracked = tracker.track(candidates)
    assert len(tracked) >= 1
    assert "cell_id" in tracked[0]

    with_countdowns = tracker.compute_countdowns(tracked)
    assert "countdown_targets" in with_countdowns[0]
    print("✅ test_cell_segmentation_and_countdowns passed!")

if __name__ == "__main__":
    test_haversine_distance()
    test_cell_segmentation_and_countdowns()
