"""
Synthetic Multi-Region Storm Generator for AntiGravity.
Generates physically consistent radar, satellite, velocity, and lightning data
simulating severe convective systems across 6 Pan-India meteorological domains and national composite.
"""

import numpy as np
import pandas as pd
from scipy.ndimage import gaussian_filter
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple

# 6 Pan-India Meteorological Radar Domains
INDIA_RADAR_DOMAINS = {
    "WEST_INDIA": {
        "name": "⚡ Western India & Ghats (Mumbai/Pune/Goa)",
        "center": [73.2, 19.2],
        "bounds": [15.0, 24.0, 70.0, 78.0],
        "storm_a": {"start": (19.4, 73.8), "vel": (-0.015, -0.045)},
        "storm_b": {"start": (20.2, 73.2), "vel": (-0.020, 0.025)}
    },
    "NORTH_INDIA": {
        "name": "🏔️ Northern Plains & Himalayas (Delhi-NCR/UK)",
        "center": [77.2, 28.6],
        "bounds": [25.0, 33.0, 74.0, 81.0],
        "storm_a": {"start": (28.9, 77.8), "vel": (-0.02, -0.04)},
        "storm_b": {"start": (30.4, 78.5), "vel": (-0.015, 0.02)}
    },
    "EAST_INDIA": {
        "name": "🌊 Eastern & Bay of Bengal (Kolkata/Odisha)",
        "center": [88.4, 22.6],
        "bounds": [18.0, 27.0, 83.0, 92.0],
        "storm_a": {"start": (23.1, 88.9), "vel": (-0.018, -0.035)},
        "storm_b": {"start": (21.5, 87.2), "vel": (0.015, -0.025)}
    },
    "SOUTH_INDIA": {
        "name": "🌴 Southern Peninsula (BLR/HYD/MAA/COK)",
        "center": [77.6, 12.9],
        "bounds": [8.0, 18.0, 73.0, 83.0],
        "storm_a": {"start": (13.4, 78.2), "vel": (-0.012, -0.038)},
        "storm_b": {"start": (11.8, 76.5), "vel": (0.01, 0.02)}
    },
    "NORTHWEST": {
        "name": "🏜️ Northwest Desert & Plains (Jaipur/Punjab)",
        "center": [73.5, 27.0],
        "bounds": [23.0, 31.0, 69.0, 77.0],
        "storm_a": {"start": (27.5, 74.8), "vel": (-0.01, -0.04)},
        "storm_b": {"start": (26.2, 72.5), "vel": (-0.015, 0.02)}
    },
    "NORTHEAST": {
        "name": "🌿 North-Eastern Hills (Guwahati/Shillong)",
        "center": [92.0, 26.0],
        "bounds": [23.0, 29.0, 89.0, 97.0],
        "storm_a": {"start": (26.4, 92.8), "vel": (-0.015, -0.035)},
        "storm_b": {"start": (25.5, 91.2), "vel": (0.01, -0.02)}
    },
    "ALL_INDIA": {
        "name": "🇮🇳 National Composite (Pan-India)",
        "center": [78.96, 21.59],
        "bounds": [6.0, 37.5, 68.0, 97.5],
        "storm_a": {"start": (19.4, 73.8), "vel": (-0.015, -0.045)},
        "storm_b": {"start": (28.9, 77.8), "vel": (-0.02, -0.04)}
    }
}

class SyntheticStormGenerator:
    def __init__(
        self,
        grid_h: int = 128,
        grid_w: int = 128,
        min_lat: float = 6.0,
        max_lat: float = 37.5,
        min_lon: float = 68.0,
        max_lon: float = 97.5,
        seed: int = 42
    ):
        self.grid_h = grid_h
        self.grid_w = grid_w
        self.min_lat = min_lat
        self.max_lat = max_lat
        self.min_lon = min_lon
        self.max_lon = max_lon
        self.rng = np.random.default_rng(seed)

    def _get_domain_config(self, region_id: str):
        return INDIA_RADAR_DOMAINS.get(region_id, INDIA_RADAR_DOMAINS["WEST_INDIA"])

    def _blob(self, lat_grid, lon_grid, lat0: float, lon0: float, peak: float, sigma_lat: float, sigma_lon: float) -> np.ndarray:
        dist_sq = ((lat_grid - lat0) / (sigma_lat + 1e-6)) ** 2 + ((lon_grid - lon0) / (sigma_lon + 1e-6)) ** 2
        blob = peak * np.exp(-0.5 * dist_sq)
        noise = self.rng.normal(0, peak * 0.04, size=blob.shape)
        blob = np.maximum(0.0, blob + noise)
        return gaussian_filter(blob, sigma=1.0)

    def generate_full_scene(self, timestep: int, region_id: str = "WEST_INDIA") -> Dict[str, Any]:
        """
        Generates full multispectral and radar scene for the specified Pan-India domain.
        """
        cfg = self._get_domain_config(region_id)
        b_min_lat, b_max_lat, b_min_lon, b_max_lon = cfg["bounds"]

        lats = np.linspace(b_max_lat, b_min_lat, self.grid_h)
        lons = np.linspace(b_min_lon, b_max_lon, self.grid_w)
        lon_grid, lat_grid = np.meshgrid(lons, lats)

        # Compute evolving positions
        s_a = cfg["storm_a"]
        s_b = cfg["storm_b"]
        lat_a = s_a["start"][0] + s_a["vel"][0] * timestep
        lon_a = s_a["start"][1] + s_a["vel"][1] * timestep

        lat_b = s_b["start"][0] + s_b["vel"][0] * timestep
        lon_b = s_b["start"][1] + s_b["vel"][1] * timestep

        growth = min(1.0, 0.45 + timestep * 0.055)
        sigma_scale = 0.06 if region_id == "ALL_INDIA" else 1.0

        # Radar Reflectivity (dBZ)
        core_a = self._blob(lat_grid, lon_grid, lat_a, lon_a, peak=65.0 * growth, sigma_lat=0.35 * sigma_scale, sigma_lon=0.45 * sigma_scale)
        hook_a = self._blob(lat_grid, lon_grid, lat_a - 0.15, lon_a + 0.1, peak=52.0 * growth, sigma_lat=0.2 * sigma_scale, sigma_lon=0.25 * sigma_scale)
        strat = self._blob(lat_grid, lon_grid, lat_a + 0.25, lon_a + 0.35, peak=36.0 * growth, sigma_lat=0.8 * sigma_scale, sigma_lon=1.1 * sigma_scale)
        cell_b = self._blob(lat_grid, lon_grid, lat_b, lon_b, peak=48.0 * growth, sigma_lat=0.25 * sigma_scale, sigma_lon=0.3 * sigma_scale)
        bg = gaussian_filter(self.rng.uniform(0.0, 5.0, size=(self.grid_h, self.grid_w)), sigma=4.0)

        dbz = np.maximum.reduce([core_a, hook_a, strat, cell_b, bg])
        dbz = np.clip(dbz, 0.0, 75.0).astype(np.float32)

        # Satellite TIR-1 Brightness Temp (Kelvin)
        background_tb = 303.0
        cooling_intensity = min(112.0, 55.0 + timestep * 6.0)
        cold_a = self._blob(lat_grid, lon_grid, lat_a, lon_a, peak=cooling_intensity, sigma_lat=0.35 * sigma_scale, sigma_lon=0.45 * sigma_scale)
        anvil_a = self._blob(lat_grid, lon_grid, lat_a + 0.2, lon_a + 0.3, peak=55.0, sigma_lat=0.75 * sigma_scale, sigma_lon=1.2 * sigma_scale)
        cold_b = self._blob(lat_grid, lon_grid, lat_b, lon_b, peak=cooling_intensity * 0.75, sigma_lat=0.25 * sigma_scale, sigma_lon=0.3 * sigma_scale)

        dep = np.maximum(cold_a + anvil_a * 0.6, cold_b)
        noise = self.rng.normal(0, 1.2, size=(self.grid_h, self.grid_w))
        tir1 = np.clip(background_tb - dep + noise, 185.0, 315.0).astype(np.float32)

        # TIR-2 for SWD
        sw_diff_clear = 3.0 + gaussian_filter(self.rng.uniform(-0.5, 0.5, size=tir1.shape), sigma=2.0)
        cloud_mask = np.clip((300.0 - tir1) / 80.0, 0.0, 1.0)
        sw_diff = sw_diff_clear * (1.0 - 0.85 * cloud_mask)
        tir2 = np.clip(tir1 - sw_diff, 180.0, 315.0).astype(np.float32)

        # Water Vapor
        wv_dep = self._blob(lat_grid, lon_grid, lat_a, lon_a, peak=32.0, sigma_lat=0.8 * sigma_scale, sigma_lon=1.1 * sigma_scale)
        wv = np.clip(262.0 - wv_dep + self.rng.normal(0, 1.0, size=(self.grid_h, self.grid_w)), 225.0, 280.0).astype(np.float32)

        # Radial Velocity (Downburst Divergence)
        bg_vel = 8.0 + self.rng.normal(0, 1.5, size=(self.grid_h, self.grid_w))
        dx = (lon_grid - lon_a) / max(0.01, 0.35 * sigma_scale)
        dy = (lat_grid - lat_a) / max(0.01, 0.35 * sigma_scale)
        dipole = 28.0 * dx * np.exp(-0.5 * (dx**2 + dy**2))
        storm_w = np.clip((dbz - 35.0) / 20.0, 0.0, 1.0)
        velocity = np.clip(bg_vel * (1.0 - storm_w) + (bg_vel + dipole) * storm_w, -35.0, 35.0).astype(np.float32)

        # Lightning Strokes
        n_a = int(self.rng.integers(max(1, timestep * 5), max(3, timestep * 12 + 6)))
        n_b = int(self.rng.integers(max(0, timestep * 2), max(1, timestep * 4 + 2)))
        records = []
        base_time = datetime.now(timezone.utc)

        if n_a > 0:
            lats_a = self.rng.normal(lat_a, 0.18 * sigma_scale, size=n_a)
            lons_a = self.rng.normal(lon_a, 0.22 * sigma_scale, size=n_a)
            amps = self.rng.uniform(15.0, 135.0, size=n_a)
            types = self.rng.choice(["CG", "IC"], p=[0.4, 0.6], size=n_a)
            for i in range(n_a):
                records.append({
                    "lat": float(lats_a[i]),
                    "lon": float(lons_a[i]),
                    "amplitude_ka": float(amps[i]),
                    "type": str(types[i]),
                    "timestamp": (base_time - timedelta(seconds=float(self.rng.uniform(0, 5)))).isoformat()
                })

        if n_b > 0:
            lats_b = self.rng.normal(lat_b, 0.12 * sigma_scale, size=n_b)
            lons_b = self.rng.normal(lon_b, 0.15 * sigma_scale, size=n_b)
            amps_b = self.rng.uniform(10.0, 75.0, size=n_b)
            types_b = self.rng.choice(["CG", "IC"], p=[0.3, 0.7], size=n_b)
            for i in range(n_b):
                records.append({
                    "lat": float(lats_b[i]),
                    "lon": float(lons_b[i]),
                    "amplitude_ka": float(amps_b[i]),
                    "type": str(types_b[i]),
                    "timestamp": (base_time - timedelta(seconds=float(self.rng.uniform(0, 5)))).isoformat()
                })

        lightning_df = pd.DataFrame(records)

        return {
            "t": timestep,
            "region_id": region_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "radar_dbz": dbz,
            "satellite_tir1": tir1,
            "satellite_tir2": tir2,
            "satellite_wv": wv,
            "velocity": velocity,
            "lightning_df": lightning_df,
            "storm_a_pos": (lat_a, lon_a),
            "storm_b_pos": (lat_b, lon_b),
            "grid_h": self.grid_h,
            "grid_w": self.grid_w,
            "bounds": cfg["bounds"]
        }
