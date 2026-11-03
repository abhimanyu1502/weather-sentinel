"""
SIH 26084 — 6-Hour Convective Weather Nowcasting & Early Warning System.
Main FastAPI Application Entrypoint.
Unifies Master PRD REST APIs, Multi-Source Ingestion, 0-6h Forecasting,
and Full Backward Compatibility for Frontend Dashboards and WebSockets.
"""

import sys
from pathlib import Path

# Add project root and backend to python path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
for p in [str(ROOT_DIR), str(BACKEND_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Path as FastPath
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.core.config import settings
from app.core.logging import setup_logging
from app.ingestion.registry import registry
from app.ingestion.sources.source_a import SourceAProvider
from app.ingestion.sources.source_b import SourceBProvider
from app.ingestion.sources.radar import RadarProvider
from app.ingestion.sources.satellite import SatelliteProvider
from app.ingestion.sources.lightning import LightningProvider
from app.ingestion.sources.demo_source import DemoWeatherProvider

# Import Master PRD Routers
from app.api.health import router as health_router
from app.api.weather import router as weather_router
from app.api.forecasts import router as forecasts_router
from app.api.hazards import router as hazards_router
from app.api.alerts import router as alerts_router
from app.api.admin import router as admin_router

# Import existing frontend-compatible routes and WebSocket engine from backend
try:
    from backend.routes.api import router as frontend_api_router, state_container, PAN_INDIA_REGIONS, LANDMARKS
    from backend.main import ws_manager, nowcast_streaming_loop
except ImportError:
    from routes.api import router as frontend_api_router, state_container, PAN_INDIA_REGIONS, LANDMARKS
    from main import ws_manager, nowcast_streaming_loop


# Initialize and register all providers
def initialize_providers():
    registry.register(SourceAProvider(enabled=True))
    registry.register(SourceBProvider(enabled=True))
    registry.register(RadarProvider(enabled=True))
    registry.register(SatelliteProvider(enabled=True))
    registry.register(LightningProvider(enabled=True))
    registry.register(DemoWeatherProvider(enabled=True))
    logger.info("All 6 meteorological providers registered successfully.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Initializing SIH 26084 Early Warning & Nowcast Platform...")
    initialize_providers()

    # Launch background nowcast streaming loop for live UI
    loop_task = asyncio.create_task(nowcast_streaming_loop())
    yield
    loop_task.cancel()
    logger.info("Shutting down nowcasting platform.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SIH 26084 — Convective Scale Nowcasting for Thunderstorms, Hail & Cloudbursts (0–6 Hours)",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Mount Master PRD Routers
app.include_router(health_router)
app.include_router(weather_router)
app.include_router(forecasts_router)
app.include_router(hazards_router)
app.include_router(alerts_router)
app.include_router(admin_router)

# 2. Mount Frontend Compatibility Router (Preserves 100% of existing frontend behavior)
app.include_router(frontend_api_router)


# 3. Mount Live WebSockets for Mission Control & GIS Dashboard
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
    uvicorn.run("app.main:app", host="127.0.0.1", port=settings.API_PORT, reload=False)
