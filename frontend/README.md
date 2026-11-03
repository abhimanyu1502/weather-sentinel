# 🎨 Frontend Web Application (React 18 + Vite + TypeScript)

This folder contains the **Weather Sentinel Mission Control Console** with high-fidelity GIS mapping (official Survey of India accredited boundaries), live WebSocket storm cell trackers, hail MESH/POSH gauges, ETA countdowns, and OASIS CAP-XML alert popups.

---

## 🚀 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start Vite local development server
npm run dev

# 3. Build production bundle
npm run build
```

---

## 🌐 Simple Server Deployment

### 1. Deploying to Vercel (Easiest — 2 Minutes)
1. Push your repository to GitHub.
2. Log in to [vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
3. Select your repository.
4. Set the **Root Directory** to `frontend`.
5. Under **Environment Variables**, add:
   * `VITE_API_BASE_URL`: URL of your backend REST API (e.g., `https://your-backend.onrender.com/api`)
   * `VITE_WS_BASE_URL`: URL of your backend WebSocket (e.g., `wss://your-backend.onrender.com`)
6. Click **Deploy**. Vercel will automatically build the site using [`vercel.json`](vercel.json).

---

### 2. Deploying to Netlify
1. Log in to [netlify.com](https://netlify.com) and click **Add new site** -> **Import an existing project**.
2. Select your repository.
3. Configure:
   * **Base directory**: `frontend`
   * **Build command**: `npm run build`
   * **Publish directory**: `frontend/dist`
4. Set environment variables `VITE_API_BASE_URL` and `VITE_WS_BASE_URL`.
5. Click **Deploy**. Netlify uses [`netlify.toml`](netlify.toml) for SPA routing.

---

### 3. Deploying via Docker (Nginx Alpine)
```bash
docker build -t stormsentinel-frontend .
docker run -d -p 80:80 stormsentinel-frontend
```
