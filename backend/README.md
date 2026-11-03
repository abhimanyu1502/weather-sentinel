# ⚡ Backend Service (FastAPI + PyTorch Nowcasting Engine)

This folder contains the complete backend pipeline for **Weather Sentinel**:
* **FastAPI REST API & WebSocket Hub**: Real-time multi-region broadcast loop (3-second interval)
* **Ingestion & Fusion**: Radar reflectivity, INSAT multispectral IR, and lightning density alignment
* **Physics Engines**: Marshall-Palmer rain rates, Cloud-Top Cooling Rate (CTCR), MESH/POSH hail sizing, and microburst divergence
* **Deep Learning Inference**: ConvLSTM spatiotemporal tensor nowcasting
* **OASIS / NDMA CAP-CP v1.2 XML**: Emergency siren and cell-broadcast alert service

---

## 🚀 Local Development

```bash
# 1. Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Launch the backend engine
python main.py
```

* API will run at: `http://localhost:8000`
* Swagger Interactive Docs: `http://localhost:8000/docs`
* Live WebSocket Feed: `ws://localhost:8000/ws/live-stream`

---

## 🧪 System Validation Checklist

Run the complete physics, tensor fusion, and ML nowcasting test runner:

```bash
python tests/validation/run_all_checks.py
```

---

## 🌐 Simple Server Deployment

### 1. Deploying to Render (Recommended — Free Tier Available)
1. Push your repository to GitHub.
2. Log in to [render.com](https://render.com) and click **New +** -> **Web Service**.
3. Select your repository.
4. Set the following options:
   * **Root Directory**: `backend`
   * **Environment**: `Docker` (Render automatically uses [`backend/Dockerfile`](Dockerfile))
   * **Health Check Path**: `/api/health`
5. Under **Environment Variables**, provide:
   * `DATABASE_URL`: Connection string from your PostGIS database (e.g. Supabase)
   * `REDIS_URL`: Connection string from your Redis instance (e.g. Upstash)
   * `DEMO_MODE`: `True`
6. Click **Create Web Service**. Render handles build and live WebSocket streaming out-of-the-box.

---

### 2. Deploying to Railway
1. Go to [railway.app](https://railway.app) and select **New Project** -> **Deploy from GitHub repo**.
2. Set root directory to `backend`.
3. Add environment variables (`DATABASE_URL`, `REDIS_URL`, `PORT=8000`).
4. Generate domain in service settings.

---

### 3. Deploying via Docker
```bash
docker build -t stormsentinel-backend .
docker run -d -p 8000:8000 stormsentinel-backend
```
