# SIH 26084 — Deployment & Infrastructure Guide

### 1. Deployment Topology

The platform supports both standalone local developer execution and production containerized orchestration.

```text
[Reverse Proxy / Nginx / Cloudflare]
                |
                +---------------------------------------+
                |                                       |
                v                                       v
   [FastAPI Application (app.main)]        [React/Vite Frontend]
   - Port: 8000                            - Port: 5173
   - Worker Processes: Uvicorn             - Static Assets / SPA
                |
                +------------------+
                |                  |
                v                  v
     [PostgreSQL + PostGIS]     [Redis]
     - Port: 5432               - Port: 6379
     - Spatial Indexing GIST    - WS Pub/Sub & Cache
```

---

### 2. Quickstart Execution (Local Development)

#### Windows:
Double-click `start.bat` or run:
```cmd
start.bat
```
This automatically initiates:
1. Docker container check (PostgreSQL/Redis if installed).
2. FastAPI backend server on `http://localhost:8000`.
3. Vite + React dashboard on `http://localhost:5173`.

#### Linux / macOS:
```bash
./start.sh
```

---

### 3. Docker Compose Production Deployment

```bash
# Build and run containers in detached mode
docker compose up -d --build

# Inspect container health
docker compose ps

# View backend application logs
docker compose logs -f backend
```

---

### 4. Environment Variables (`.env`)
```env
APP_ENV=production
APP_NAME=SIH26084-WeatherNowcast
API_HOST=0.0.0.0
API_PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/weather_nowcast
REDIS_URL=redis://redis:6379/0
ADMIN_API_KEY=sih2026-nowcast-admin-key
MIN_WARNING_LEAD_MINUTES=60
TARGET_WARNING_LEAD_HOURS=6
LOG_LEVEL=INFO
```
