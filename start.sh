#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "===================================================================="
echo " * StormSentinel (AntiGravity v3.0.0) — Platform Launcher"
echo " * Severe Convective Storm Nowcasting & Mission Control"
echo "===================================================================="
echo ""

# ----------------------------------------------------------------------------
# STEP 1: Database & Cache (PostgreSQL / PostGIS + Redis)
# ----------------------------------------------------------------------------
echo "[Step 1/3] Checking Database & Cache Services..."

if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo "[OK] Docker daemon detected. Starting Redis and PostGIS containers..."
    docker compose up -d redis postgres 2>/dev/null || docker-compose up -d redis postgres 2>/dev/null || true
    echo "[OK] Database & Cache containers running."
else
    echo "[INFO] Docker daemon is not active."
    echo "       FastAPI backend will run in self-contained in-memory streaming mode."
fi

echo ""

# ----------------------------------------------------------------------------
# STEP 2: Launch FastAPI Backend Server
# ----------------------------------------------------------------------------
echo "[Step 2/3] Starting AntiGravity FastAPI Backend Engine..."

PYTHON_EXEC="python3"
if [ -f "backend/.venv/bin/python" ]; then
    PYTHON_EXEC="backend/.venv/bin/python"
elif [ -f ".venv/bin/python" ]; then
    PYTHON_EXEC=".venv/bin/python"
elif command -v python &> /dev/null; then
    PYTHON_EXEC="python"
fi

echo "[OK] Using Python environment: $PYTHON_EXEC"
(cd "$SCRIPT_DIR/backend" && $PYTHON_EXEC main.py) &
BACKEND_PID=$!

trap "kill $BACKEND_PID 2>/dev/null || true; exit" SIGINT SIGTERM EXIT

sleep 2
echo "[OK] Backend server launched on http://localhost:8000"
echo ""

# ----------------------------------------------------------------------------
# STEP 3: Launch Vite Frontend Dashboard
# ----------------------------------------------------------------------------
echo "[Step 3/3] Starting Vite Frontend Dashboard..."

cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo ""
echo "===================================================================="
echo " * AntiGravity StormSentinel Platform Running Successfully!"
echo "===================================================================="
echo "  - Frontend Dashboard : http://localhost:5173"
echo "  - REST API Root      : http://localhost:8000/api"
echo "  - Live WebSocket     : ws://localhost:8000/ws/live-stream"
echo "  - Swagger API Docs   : http://localhost:8000/docs"
echo "===================================================================="
echo ""

if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:5173" &
elif command -v open &> /dev/null; then
    open "http://localhost:5173" &
fi

npm run dev
