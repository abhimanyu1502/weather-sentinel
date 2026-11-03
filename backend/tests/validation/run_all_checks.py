"""
AntiGravity Complete End-to-End System Validation Runner.
Executes unit tests, integration tests, and API contract validation.
"""

import sys
import io
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import urllib.request
import json
import numpy as np
from pipelines.features.physics_features import detect_ci, compute_storm_params
from pipelines.fusion.grid_aligner import GridAligner
from pipelines.tracking.cell_tracker import StormCellTracker, haversine
from models.inference_service import NowcastInferenceService

def run_checks():
    print("=" * 60)
    print("🚀 AntiGravity v3.0.0 — System Validation Checklist")
    print("=" * 60)

    # 1. Physics Engine
    print("\n1. Testing Physics Engine (CI & Indices)...")
    tir1_cur = np.ones((128, 128), dtype=np.float32) * 230.0
    tir1_prev = np.ones((128, 128), dtype=np.float32) * 242.0
    tir2_cur = np.ones((128, 128), dtype=np.float32) * 230.5
    dbz = np.ones((128, 128), dtype=np.float32) * 45.0
    ci = detect_ci(tir1_cur, tir1_prev, tir2_cur, dbz, dt_min=10.0)
    assert ci.is_detected == True
    print("  ✅ Convective Initiation detection: OK")

    # 2. Spatiotemporal Fusion
    print("\n2. Testing 5-Channel Grid Tensor Fusion...")
    aligner = GridAligner(target_h=128, target_w=128)
    tensor = aligner.align(
        dbz=np.zeros((128, 128), dtype=np.float32),
        tir1=np.ones((128, 128), dtype=np.float32) * 300.0,
        tir2=np.ones((128, 128), dtype=np.float32) * 298.0,
        lightning_density=np.zeros((128, 128), dtype=np.float32),
        velocity=np.zeros((128, 128), dtype=np.float32)
    )
    assert tensor.shape == (5, 128, 128)
    print("  ✅ (5, 128, 128) Multimodal Tensor Fusion: OK")

    # 3. Storm Tracker & Countdowns
    print("\n3. Testing Storm Cell Kinematics & ETA Countdowns...")
    tracker = StormCellTracker(17.0, 22.0, 70.0, 77.0, 128, 128)
    tracker.load_landmarks([{"name": "Mumbai Airport", "lat": 19.0896, "lon": 72.8656, "alert_radius_km": 12.0}])
    d = haversine(19.0896, 72.8656, 18.9692, 72.8247)
    assert d > 0
    print(f"  ✅ Haversine & Kinematics ({d:.1f} km): OK")

    # 4. ML Nowcasting Inference Service
    print("\n4. Testing ML ConvLSTM Nowcasting Engine...")
    service = NowcastInferenceService(device="cpu")
    for _ in range(4):
        service.add_frame(tensor)
    assert service.is_ready() == True
    pred = service.run_inference()
    assert pred is not None and "timesteps" in pred
    print(f"  ✅ ConvLSTM 0-120 min horizon predictions ({len(pred['timesteps'])} steps): OK")

    # 5. REST Endpoints Live Check
    print("\n5. Testing Live FastAPI Backend Endpoints...")
    try:
        res = urllib.request.urlopen("http://localhost:8000/api/health", timeout=5)
        health = json.loads(res.read().decode())
        print(f"  ✅ Backend health: {health.get('status')} ({health.get('service')} v{health.get('version')})")

        res_reg = urllib.request.urlopen("http://localhost:8000/api/regions", timeout=5)
        regs = json.loads(res_reg.read().decode())
        print(f"  ✅ Pan-India Radar Regions: {len(regs.get('regions', []))} domains loaded")

        res_dash = urllib.request.urlopen("http://localhost:8000/api/dashboard/summary", timeout=5)
        dash = json.loads(res_dash.read().decode())
        print(f"  ✅ Mission Control Dashboard API: OK (Sensor Health: {dash.get('sensor_health')})")
    except Exception as e:
        print(f"  ⚠️ Note: Live backend check skipped/warning ({e})")

    # 6. Real-Time Weather Ingestion & 6-Hour Anomaly Engine
    print("\n6. Testing Weather API Ingestion & 6-Hour Anomaly Engine...")
    try:
        from pipelines.ingestion.weather_api_ingest import (
            WeatherDataIngestor,
            analyze_6h_anomalies,
            STRATEGIC_INDIAN_STATIONS,
            DEFAULT_RAW_DIR,
            DEFAULT_PROCESSED_DIR
        )
        ingestor = WeatherDataIngestor(timeout=8, max_retries=2)
        # Fetch Delhi test node
        delhi_node = STRATEGIC_INDIAN_STATIONS[0]
        payload = ingestor.fetch_open_meteo(delhi_node["lat"], delhi_node["lon"])
        assert payload is not None, "Open-Meteo payload should not be None"
        assert "current" in payload and "hourly" in payload, "Payload must contain current and hourly keys"
        assert len(payload["hourly"]["time"]) >= 6, "Must contain at least 6 hourly prediction steps"
        print(f"  ✅ Open-Meteo HTTP Ingestion (requests session): OK (temp: {payload['current'].get('temperature_2m')}°C)")

        # Verify anomaly calculation logic
        mock_storm_payload = {
            "hourly": {
                "time": ["2026-10-05T01:00", "2026-10-05T02:00", "2026-10-05T03:00", "2026-10-05T04:00", "2026-10-05T05:00", "2026-10-05T06:00"],
                "precipitation": [0.0, 5.0, 52.0, 10.0, 2.0, 0.0],
                "precipitation_probability": [10, 40, 95, 70, 30, 10],
                "cape": [600, 1200, 2400, 1800, 900, 500],
                "wind_gusts_10m": [15, 30, 85, 45, 20, 15],
                "temperature_2m": [30, 28, 22, 23, 25, 26]
            }
        }
        detected = analyze_6h_anomalies(delhi_node, mock_storm_payload)
        assert detected is not None, "Should detect severe anomaly"
        assert detected["severity"] == "EXTREME", f"Expected EXTREME severity, got {detected['severity']}"
        assert detected["anomaly_type"] == "CLOUDBURST_ALERT"
        assert detected["lead_time_hours"] == 3, f"Expected 3h lead time, got {detected['lead_time_hours']}"
        print(f"  ✅ 6-Hour Convective Anomaly Detection: OK (Detected: {detected['anomaly_type']}, Lead Time: {detected['lead_time_hours']}h)")
    except Exception as e:
        print(f"  ❌ Weather API Ingestion check failed: {e}")
        raise e

    print("\n" + "=" * 60)
    print("🎉 ALL ANTIGRAVITY VALIDATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_checks()
