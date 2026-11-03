"""
seed_demo_data.py — Seeds sample datasets and verification events into data/sample/.
Complies with Section 5 of SIH 26084 PRD.
"""

import json
from pathlib import Path

import sys
# Ensure Windows terminal doesn't crash on UTF-8 emojis
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
SAMPLE_DIR = ROOT_DIR / "data" / "sample"


def seed_data():
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

    sample_radar = {
        "timestamp": "2026-10-08T00:00:00Z",
        "station": "DWR_DELHI_PALAM",
        "frequency_ghz": 2.8,
        "max_reflectivity_dbz": 54.2,
        "radial_velocity_max_ms": 28.5,
        "echo_top_km": 14.2,
        "cells_segmented": 3
    }
    with open(SAMPLE_DIR / "sample_radar_frame.json", "w", encoding="utf-8") as f:
        json.dump(sample_radar, f, indent=2)

    sample_insat = {
        "timestamp": "2026-10-08T00:00:00Z",
        "satellite": "INSAT-3DR",
        "instrument": "IMAGER_TIR1",
        "min_cloud_top_temp_k": 204.5,
        "min_cloud_top_temp_c": -68.65,
        "overshooting_top_flag": True,
        "cooling_rate_k_per_15min": -7.4
    }
    with open(SAMPLE_DIR / "sample_satellite_frame.json", "w", encoding="utf-8") as f:
        json.dump(sample_insat, f, indent=2)

    print(f"✅ Sample datasets seeded to: {SAMPLE_DIR}")


if __name__ == "__main__":
    seed_data()
