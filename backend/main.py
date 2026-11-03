"""
AntiGravity Main Backend Application (v3.0.0).
FastAPI REST API + Multi-Region WebSocket Streaming Engine for Pan-India Severe Weather Nowcasting.
"""

import sys
from pathlib import Path

# Ensure backend directory and repo root are on Python path
BACKEND_DIR = Path(__file__).resolve().parent
REPO_DIR = BACKEND_DIR.parent
for p in [str(BACKEND_DIR), str(REPO_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import asyncio
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Path as FastPath
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from pipelines.ingestion.synthetic_generator import SyntheticStormGenerator, INDIA_RADAR_DOMAINS
from pipelines.ingestion.lightning_ingest import generate_lightning_density_grid
from pipelines.fusion.grid_aligner import GridAligner
from pipelines.features.physics_features import detect_ci, compute_storm_params
from pipelines.tracking.cell_tracker import StormCellTracker
from models.inference_service import NowcastInferenceService
try:
    from routes.api import router as api_router, LANDMARKS, state_container, PAN_INDIA_REGIONS
except ImportError:
    from backend.routes.api import router as api_router, LANDMARKS, state_container, PAN_INDIA_REGIONS

# Initialize pipeline modules
storm_generator = SyntheticStormGenerator(
    grid_h=settings.GRID_H,
    grid_w=settings.GRID_W,
    min_lat=settings.DOMAIN_MIN_LAT,
    max_lat=settings.DOMAIN_MAX_LAT,
    min_lon=settings.DOMAIN_MIN_LON,
    max_lon=settings.DOMAIN_MAX_LON
)

grid_aligner = GridAligner(target_h=settings.GRID_H, target_w=settings.GRID_W)

cell_tracker = StormCellTracker(
    min_lat=settings.DOMAIN_MIN_LAT,
    max_lat=settings.DOMAIN_MAX_LAT,
    min_lon=settings.DOMAIN_MIN_LON,
    max_lon=settings.DOMAIN_MAX_LON,
    grid_h=settings.GRID_H,
    grid_w=settings.GRID_W,
    res_km=settings.GRID_RESOLUTION_KM
)
cell_tracker.load_landmarks(LANDMARKS)

nowcaster = NowcastInferenceService(
    device=settings.INFERENCE_DEVICE,
    checkpoint_path=settings.MODEL_CHECKPOINT_PATH
)

# Multi-Region WebSocket Connection Manager
class MultiRegionWebSocketManager:
    def __init__(self):
        self.global_connections: List[WebSocket] = []
        self.region_connections: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect_global(self, websocket: WebSocket):
        await websocket.accept()
        self.global_connections.append(websocket)

    def disconnect_global(self, websocket: WebSocket):
        if websocket in self.global_connections:
            self.global_connections.remove(websocket)

    async def connect_region(self, websocket: WebSocket, region_id: str):
        await websocket.accept()
        self.region_connections[region_id].append(websocket)

    def disconnect_region(self, websocket: WebSocket, region_id: str):
        if websocket in self.region_connections[region_id]:
            self.region_connections[region_id].remove(websocket)

    async def broadcast(self, data: Dict[str, Any], region_id: str = "ALL_INDIA"):
        # Broadcast to general subscribers
        dead_global = []
        for connection in self.global_connections:
            try:
                await connection.send_json(data)
            except Exception:
                dead_global.append(connection)
        for dead in dead_global:
            self.disconnect_global(dead)

        # Broadcast to dedicated region subscribers
        dead_region = []
        for connection in self.region_connections.get(region_id, []):
            try:
                await connection.send_json(data)
            except Exception:
                dead_region.append(connection)
        for dead in dead_region:
            self.disconnect_region(dead, region_id)

ws_manager = MultiRegionWebSocketManager()
prev_tir1_holder: Dict[str, Optional[np.ndarray]] = defaultdict(lambda: None)

def process_region_pipeline(region_id: str, sim_t: int, is_radar_offline: bool):
    """Executes ingestion, fusion, CI detection, and tracking for a specific radar domain."""
    scene = storm_generator.generate_full_scene(sim_t, region_id=region_id)
    dbz = scene["radar_dbz"]
    tir1 = scene["satellite_tir1"]
    tir2 = scene["satellite_tir2"]
    velocity = scene["velocity"]
    lightning_df = scene["lightning_df"]

    if is_radar_offline:
        coldness = np.clip((290.0 - tir1) / 75.0, 0.0, 1.0)
        dbz = (coldness * 58.0).astype(np.float32)
        velocity = np.zeros_like(velocity)

    b_min_lat, b_max_lat, b_min_lon, b_max_lon = scene["bounds"]
    lightning_density = generate_lightning_density_grid(
        strokes_df=lightning_df,
        min_lat=b_min_lat,
        max_lat=b_max_lat,
        min_lon=b_min_lon,
        max_lon=b_max_lon,
        grid_h=settings.GRID_H,
        grid_w=settings.GRID_W
    )

    tensor_5ch = grid_aligner.align(
        dbz=dbz,
        tir1=tir1,
        tir2=tir2,
        lightning_density=lightning_density,
        velocity=velocity
    )

    ci_status = detect_ci(
        tir1_cur=tir1,
        tir1_prev=prev_tir1_holder[region_id],
        tir2_cur=tir2,
        dbz=dbz,
        dt_min=10.0
    )

    cell_tracker.min_lat = b_min_lat
    cell_tracker.max_lat = b_max_lat
    cell_tracker.min_lon = b_min_lon
    cell_tracker.max_lon = b_max_lon

    candidates = cell_tracker.segment(
        dbz_grid=dbz,
        threshold=settings.REFLECTIVITY_STORM_THRESHOLD_DBZ,
        min_area_km2=settings.MIN_STORM_AREA_KM2
    )
    tracked_cells = cell_tracker.track(candidates)
    tracked_cells = cell_tracker.compute_countdowns(tracked_cells)

    processed_cells = []
    cloudburst_count = 0
    severe_hail_count = 0

    for cell in tracked_cells:
        r_min, c_min, r_max, c_max = cell["bbox"]
        r_min = max(0, r_min)
        c_min = max(0, c_min)
        r_max = min(settings.GRID_H, r_max + 1)
        c_max = min(settings.GRID_W, c_max + 1)

        params = compute_storm_params(
            dbz_patch=dbz[r_min:r_max, c_min:c_max],
            vel_patch=velocity[r_min:r_max, c_min:c_max],
            tir1_patch=tir1[r_min:r_max, c_min:c_max],
            lightning_patch=lightning_density[r_min:r_max, c_min:c_max],
            cell_id=cell["cell_id"]
        )

        if params.is_cloudburst:
            cloudburst_count += 1
        if params.is_severe_hail:
            severe_hail_count += 1

        processed_cells.append({
            "cell_id": cell["cell_id"],
            "severity": params.severity_level,
            "lat": cell["lat"],
            "lon": cell["lon"],
            "area_km2": cell["area_km2"],
            "max_dbz": params.max_dbz,
            "hail_mesh_mm": params.hail_mesh_mm,
            "hail_posh_pct": params.hail_posh_pct,
            "rain_rate_mm_hr": params.rain_rate_mm_hr,
            "downburst_gust_kmh": params.downburst_gust_kmh,
            "is_cloudburst": params.is_cloudburst,
            "is_severe_hail": params.is_severe_hail,
            "is_downburst": params.is_downburst,
            "lightning_intensity": params.lightning_flash_rate,
            "movement": cell["movement"],
            "countdown_targets": cell.get("countdown_targets", [])
        })

    max_domain_dbz = float(np.max(dbz))
    z_lin = 10.0 ** (max_domain_dbz / 10.0)
    max_domain_rain = float(round((z_lin / 300.0) ** (1.0 / 1.4), 1))
    total_strokes = len(lightning_df) if lightning_df is not None else 0

    state_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "simulation_timestep": sim_t,
        "region_id": region_id,
        "sensor_mode": "SATELLITE_FALLBACK" if is_radar_offline else "RADAR_FUSED",
        "convective_initiation": {
            "detected": ci_status.is_detected,
            "confidence": ci_status.confidence,
            "triggers": ci_status.triggers,
            "ctcr_k_per_15min": ci_status.ctcr_k_per_15min,
            "min_tir1_k": ci_status.min_tir1_k,
            "min_swd_k": ci_status.min_swd_k
        },
        "domain_summary": {
            "max_reflectivity_dbz": round(max_domain_dbz, 1),
            "max_rain_rate_mm_hr": max_domain_rain,
            "total_lightning_strokes": total_strokes,
            "active_storm_cells": len(processed_cells),
            "cloudburst_cells": cloudburst_count,
            "severe_hail_cells": severe_hail_count
        },
        "active_storm_cells": processed_cells,
        "nowcast": None,
        "nowcast_available": False
    }

    prev_tir1_holder[region_id] = tir1.copy()
    return state_payload, tensor_5ch

async def nowcast_streaming_loop():
    """
    Background asynchronous loop executing ingestion, fusion, CI detection, tracking,
    and ML nowcasting every broadcast interval (3 seconds) across monitored Pan-India domains.
    """
    print("Starting AntiGravity Pan-India Real-Time Nowcast Engine Loop...")
    while True:
        try:
            sim_t = state_container.get("sim_t", 0)
            is_radar_offline = state_container.get("radar_offline_mode", False)
            active_region = state_container.get("active_region", "WEST_INDIA")

            regions_to_update = {active_region, "ALL_INDIA"}
            for r_id, conns in ws_manager.region_connections.items():
                if conns:
                    regions_to_update.add(r_id)

            for reg_id in regions_to_update:
                payload, tensor_5ch = process_region_pipeline(reg_id, sim_t, is_radar_offline)

                if reg_id == active_region:
                    nowcaster.add_frame(tensor_5ch)
                    ml_forecast = nowcaster.run_inference()
                    payload["nowcast"] = ml_forecast
                    payload["nowcast_available"] = ml_forecast is not None
                    state_container["current_state"] = payload

                state_container.setdefault("regions_state", {})[reg_id] = payload
                await ws_manager.broadcast(payload, region_id=reg_id)

            state_container["sim_t"] = sim_t + 1

        except Exception as e:
            print(f"Error in nowcast loop: {e}")

        await asyncio.sleep(settings.DEMO_BROADCAST_INTERVAL_SEC)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.main import initialize_providers
        initialize_providers()
    except Exception as e:
        print(f"Provider initialization note: {e}")
    loop_task = asyncio.create_task(nowcast_streaming_loop())
    yield
    loop_task.cancel()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AntiGravity Pan-India Severe Weather Nowcasting & 3D Atmospheric Intelligence",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# Mount SIH 26084 Master PRD Endpoints
try:
    from app.api.health import router as prd_health_router
    from app.api.weather import router as prd_weather_router
    from app.api.forecasts import router as prd_forecasts_router
    from app.api.hazards import router as prd_hazards_router
    from app.api.alerts import router as prd_alerts_router
    from app.api.admin import router as prd_admin_router

    app.include_router(prd_health_router)
    app.include_router(prd_weather_router)
    app.include_router(prd_forecasts_router)
    app.include_router(prd_hazards_router)
    app.include_router(prd_alerts_router)
    app.include_router(prd_admin_router)
except Exception as err:
    print(f"PRD routes mount note: {err}")


@app.websocket("/ws/live-stream")
async def websocket_live_stream(websocket: WebSocket):
    await ws_manager.connect_global(websocket)
    curr = state_container.get("current_state")
    if curr:
        try:
            await websocket.send_json(curr)
        except Exception:
            pass

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_global(websocket)
    except Exception:
        ws_manager.disconnect_global(websocket)

@app.websocket("/ws/regions/{region_id}")
async def websocket_region_stream(websocket: WebSocket, region_id: str = FastPath(...)):
    await ws_manager.connect_region(websocket, region_id)
    reg_state = state_container.get("regions_state", {}).get(region_id, state_container.get("current_state"))
    if reg_state:
        try:
            await websocket.send_json(reg_state)
        except Exception:
            pass

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_region(websocket, region_id)
    except Exception:
        ws_manager.disconnect_region(websocket, region_id)

if __name__ == "__main__":
    import uvicorn
    # Support running from either root or backend directory
    app_module = "main:app" if Path("main.py").exists() else "backend.main:app"
    uvicorn.run(app_module, host="127.0.0.1", port=settings.API_PORT, reload=False)

