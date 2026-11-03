# StormSentinel — Severe Weather Nowcasting & Convective Initiation System

## System Architecture, Guide & Master Implementation Reference

> **Authoritative Documentation**: All current system requirements, physics formulation, sensor data flows, integration gaps (F1–F20, B1–B12), database schemas, and MVP phases are maintained in:
> 📄 [PRD-and-Integration-Gaps.md](file:///c:/Users/abhim/OneDrive/Documents/sih%202nd%20project/docs/PRD-and-Integration-Gaps.md)

---

## 1. Executive Summary

Traditional physics-based Numerical Weather Prediction (NWP) models (e.g., operational GFS, WRF, NCMRWF unified model) run on 3 to 6-hour assimilation cycles at 9–12 km grid spacing and take 30–90 minutes to compute. Convective storm cells, however, are 2–30 km in scale, evolve within 15–45 minutes, and produce high-impact localized hazards: **cloudbursts**, **severe hail (MESH/POSH)**, **downbursts / microbursts**, and **deadly lightning strikes**.

**StormSentinel** is a real-time multi-source data fusion and machine learning nowcasting platform providing **0–6 hour lead time** at **1–3 km spatial resolution** across India.

---

## 2. Real-Time Data Ingestion & Physics Formulation

### 2.1 Sensor Sources (Pan-India)

| Source | Parameters / Bands | Resolution / Cadence | Access Interface |
|---|---|---|---|
| **IMD Doppler Weather Radar (DWR)** | Reflectivity ($Z$), Radial Velocity ($V$), Spectrum Width ($W$), Dual-Pol ($Z_{DR}, K_{DP}$) | 0.25–1 km / 10 min | MOSDAC / IMD Mausam API (ODIM-H5, NetCDF) |
| **INSAT-3D / 3DR / 3DS Imager** | TIR-1 (10.8 µm), TIR-2 (12.0 µm), WV (6.8 µm), VIS (0.65 µm) | 1–4 km / 15 min | MOSDAC S3 & NRT feeds |
| **Ground Lightning (DAMINI / LINET)** | Intra-cloud (IC) + Cloud-to-ground (CG) strokes, peak current, polarity | ~5 km / Real-time (<10s) | IMD Damini / IITM lightning stream |
| **Surface Stations (AWS / ARG)** | Temp, Dew Point, Barometric Pressure, 10m Wind Speed & Gusts | Point obs / 15–60 min | IMD Meghdoot API |

### 2.2 Operational Severe Weather Indices

* **Convective Initiation (CTCR)**: Cloud-Top Cooling Rate $\le -4\text{ K}/15\text{ min}$ with Split-Window Difference $(T_{10.8} - T_{12.0}) < 1\text{ K}$ and first radar echo $\ge 35\text{ dBZ}$.
* **Hail Sizing (MESH & POSH)**:
  * Maximum Expected Size of Hail: $\text{MESH} = (\text{dBZ} - 49) \times 1.5\text{ mm}$ for $\text{dBZ} > 49$.
  * Probability of Severe Hail: $\text{POSH} = 29 \cdot \log(2.54 \cdot \sqrt{\text{MESH}^2/2.6 + 2.6} + 1)\%$.
* **Rainfall Rate (Marshall-Palmer Z-R)**:
  $$R = \left(\frac{Z}{300}\right)^{1/1.4}\text{ mm/h}$$
* **Cloudburst Warning**: Rain rate $R \ge 100\text{ mm/h}$ over a 1–3 km storm cell footprint.
* **Downburst / Microburst**: Radial velocity divergence $\Delta V \ge 25\text{ m/s}$ (55+ km/h gust) co-located with a 45+ dBZ core.

---

## 3. High-Fidelity GIS & Official Survey of India Map

The frontend GIS console ([Map2D.tsx](file:///c:/Users/abhim/OneDrive/Documents/sih%202nd%20project/frontend/src/components/Map2D.tsx)) strictly implements the **official Survey of India political boundary**:

* **Territorial Accuracy**: Covers complete Jammu & Kashmir and Ladakh up to 37.078° N (Indira Col), Siachen Glacier, Aksai Chin, Arunachal Pradesh along the McMahon Line up to 97.415° E, Gujarat (Sir Creek & Great Rann of Kutch), and all island territories (Andaman & Nicobar Islands and Lakshadweep).
* **Basemap Deconfliction**: Automatically suppresses conflicting third-party international border layers from Carto basemap, rendering the official Survey of India boundary with custom tactical styling (`ag-land-fill` #101f38, `ag-land-border` #4cc9f0 cyan glow, and `ag-states-line` interior state borders).
* **Bounds**: National bounding box `[68.15, 6.7, 97.45, 37.15]` with responsive zoom and city/storm cell clustering.

---

## 4. Software Architecture & Component Directory

```
sih 2nd project/
├── backend/                           # FastAPI live nowcast service & WebSocket hub
│   ├── main.py                        # Broadcast loop, CORS, lifecycle management
│   ├── routes/                        # REST endpoints (/regions, /landmarks, /alerts/cap)
│   ├── models/                        # ConvLSTM nowcasting checkpoint & inference engine
│   ├── pipelines/                     # Synthetic generator, GridAligner, StormCellTracker
│   └── tools/                         # Automated pipeline generating official SOI GeoJSON
├── frontend/                          # React 18 + Vite + TypeScript + MapLibre GL
│   ├── public/geo/                    # Optimized SOI GeoJSON boundary assets
│   └── src/                           # Map2D, LeftRail, TopBar, DashboardGrid, CellDrawer
├── database/                          # PostGIS extensions, storm tables & landmarks
├── docs/                              # PRD, DESIGN & Architecture guides
├── start.bat                          # 1-Click Windows Platform Launcher
└── start.sh                           # 1-Click Linux / macOS Platform Launcher
```

---

## 5. Development & Running Locally

### 1-Click Launch (Windows)
Double-click `start.bat` or run:
```cmd
start.bat
```

### 1-Click Launch (Linux / macOS)
```bash
./start.sh
```

### Manual Frontend Launch

```bash
cd frontend
npm install
npm run dev      # Local Vite dev server
npm run build    # Production bundle verification
```

### Manual Backend Launch

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

---

## 6. Project Roadmap & Prioritized Execution

Refer to Section 5 & 6 of [PRD-and-Integration-Gaps.md](file:///c:/Users/abhim/OneDrive/Documents/sih%202nd%20project/stormsentinel/docs/PRD-and-Integration-Gaps.md) for the active milestone tasks:
1. **MVP-1 (Live Wiring)**: Integrate `backendAdapter.ts` and connect live WebSocket stream between FastAPI backend and React frontend.
2. **MVP-2 (Real Data Ingestion)**: Wire live MOSDAC DWR and INSAT-3DR data adapters.
3. **MVP-3 (ML Intelligence)**: Connect ConvLSTM spatial extrapolation tensor nowcasts.
4. **MVP-4 (Public Alerting)**: CAP-XML distribution, SMS escalation, and multilingual advisory console.
