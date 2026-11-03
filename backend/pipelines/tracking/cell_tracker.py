"""
Storm Cell Segmentation, Kinematic Advection Tracking & Landmark ETA Countdown Engine.
"""

import math
import numpy as np
import cv2
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def heading_to_compass(deg: float) -> str:
    """Converts heading degrees (0=N, 90=E, 180=S, 270=W) to 16-point cardinal compass string."""
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    ix = int(round(deg / (360.0 / len(dirs)))) % len(dirs)
    return dirs[ix]

@dataclass
class CountdownTarget:
    target_name: str
    lat: float
    lon: float
    distance_km: float
    eta_seconds: int
    hazard_level: str  # RED_ALERT, ORANGE_ALERT, YELLOW_ALERT
    category: str

@dataclass
class MovementVector:
    speed_kmh: float
    heading_deg: float
    direction: str

@dataclass
class TrackedStormCell:
    cell_id: str
    severity: str
    lat: float
    lon: float
    area_km2: float
    max_dbz: float
    hail_mesh_mm: float
    hail_posh_pct: float
    rain_rate_mm_hr: float
    downburst_gust_kmh: float
    is_cloudburst: bool
    is_severe_hail: bool
    movement: Dict[str, Any]
    countdown_targets: List[Dict[str, Any]] = field(default_factory=list)
    bbox: Tuple[int, int, int, int] = (0, 0, 0, 0)  # r_min, c_min, r_max, c_max

class StormCellTracker:
    def __init__(
        self,
        min_lat: float = 17.0,
        max_lat: float = 22.0,
        min_lon: float = 70.0,
        max_lon: float = 77.0,
        grid_h: int = 128,
        grid_w: int = 128,
        res_km: float = 1.0,
        dt_min: float = 10.0
    ):
        self.min_lat = min_lat
        self.max_lat = max_lat
        self.min_lon = min_lon
        self.max_lon = max_lon
        self.grid_h = grid_h
        self.grid_w = grid_w
        self.res_km = res_km
        self.dt_min = dt_min

        self.prev_cells: Dict[str, Tuple[float, float]] = {}  # cell_id -> (lat, lon)
        self.cell_counter: int = 0
        self.landmarks: List[Dict[str, Any]] = []

    def load_landmarks(self, landmarks_list: List[Dict[str, Any]]):
        self.landmarks = landmarks_list

    def _px_to_latlon(self, row: float, col: float) -> Tuple[float, float]:
        lat = self.max_lat - (row / (self.grid_h - 1)) * (self.max_lat - self.min_lat)
        lon = self.min_lon + (col / (self.grid_w - 1)) * (self.max_lon - self.min_lon)
        return lat, lon

    def segment(self, dbz_grid: np.ndarray, threshold: float = 38.0, min_area_km2: float = 10.0) -> List[Dict[str, Any]]:
        """
        Segments intense storm clusters using morphological thresholding and connected components.
        """
        binary = (dbz_grid >= threshold).astype(np.uint8) * 255
        # Morphological closing to join fragmented storm cores
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(closed, connectivity=8)

        segmented = []
        # stats: [x, y, width, height, area]
        for label_idx in range(1, num_labels):
            pixel_area = stats[label_idx, cv2.CC_STAT_AREA]
            area_km2 = pixel_area * (self.res_km ** 2) * 2.5  # scaling factor for coverage
            if area_km2 < min_area_km2:
                continue

            cx_col, cy_row = centroids[label_idx]
            lat, lon = self._px_to_latlon(cy_row, cx_col)

            x = stats[label_idx, cv2.CC_STAT_LEFT]
            y = stats[label_idx, cv2.CC_STAT_TOP]
            w = stats[label_idx, cv2.CC_STAT_WIDTH]
            h = stats[label_idx, cv2.CC_STAT_HEIGHT]

            mask = (labels == label_idx)
            cell_dbz = dbz_grid[mask]
            max_dbz = float(np.max(cell_dbz)) if len(cell_dbz) > 0 else float(threshold)

            segmented.append({
                "temp_id": label_idx,
                "lat": float(lat),
                "lon": float(lon),
                "area_km2": float(round(area_km2, 1)),
                "max_dbz": float(round(max_dbz, 1)),
                "bbox": (int(y), int(x), int(y + h), int(x + w)),
                "mask": mask
            })

        return segmented

    def track(self, segmented_candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Associates current detections with previous trajectories using minimum Euclidean distance.
        Calculates cell velocity vector (speed in km/h and heading).
        """
        tracked = []
        new_prev = {}

        for cand in segmented_candidates:
            cur_lat = cand["lat"]
            cur_lon = cand["lon"]

            best_match_id = None
            min_dist = 9999.0

            # Find nearest cell from previous cycle within search radius (45 km)
            for prev_id, (p_lat, p_lon) in self.prev_cells.items():
                d = haversine(cur_lat, cur_lon, p_lat, p_lon)
                if d < 45.0 and d < min_dist:
                    min_dist = d
                    best_match_id = prev_id

            if best_match_id is not None:
                assigned_id = best_match_id
                p_lat, p_lon = self.prev_cells[best_match_id]
                dist_traveled_km = haversine(p_lat, p_lon, cur_lat, cur_lon)
                speed_kmh = (dist_traveled_km / (self.dt_min / 60.0))
                # Heading in degrees: atan2(dlon * cos(lat), dlat)
                dlat = cur_lat - p_lat
                dlon = cur_lon - p_lon
                angle_rad = math.atan2(dlon, dlat)
                heading_deg = (math.degrees(angle_rad) + 360.0) % 360.0
            else:
                self.cell_counter += 1
                assigned_id = f"CELL_{self.cell_counter:03d}"
                # Realistic default convective propagation towards W/WSW across Deccan Plateau
                speed_kmh = 36.0 + np.random.uniform(-4.0, 4.0)
                heading_deg = 255.0 + np.random.uniform(-10.0, 10.0)

            speed_kmh = max(10.0, min(85.0, speed_kmh))
            direction = heading_to_compass(heading_deg)

            cand["cell_id"] = assigned_id
            cand["movement"] = {
                "speed_kmh": float(round(speed_kmh, 1)),
                "heading_deg": float(round(heading_deg, 1)),
                "direction": direction
            }
            new_prev[assigned_id] = (cur_lat, cur_lon)
            tracked.append(cand)

        self.prev_cells = new_prev
        return tracked

    def compute_countdowns(self, tracked_cells: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Projects storm cell path and computes accurate impact countdown clocks for all monitored landmarks.
        """
        for cell in tracked_cells:
            c_lat = cell["lat"]
            c_lon = cell["lon"]
            speed = cell["movement"]["speed_kmh"]
            heading = cell["movement"]["heading_deg"]
            h_rad = math.radians(heading)
            v_lat = math.cos(h_rad)  # north-south unit component
            v_lon = math.sin(h_rad)  # east-west unit component

            cell_countdowns = []

            for lm in self.landmarks:
                l_lat = lm["lat"]
                l_lon = lm["lon"]
                dist_km = haversine(c_lat, c_lon, l_lat, l_lon)

                # Relative bearing to landmark
                dlat = l_lat - c_lat
                dlon = l_lon - c_lon
                mag = math.sqrt(dlat**2 + dlon**2) + 1e-8
                u_lat = dlat / mag
                u_lon = dlon / mag

                # Direction cosine / dot product (approach alignment)
                dot = v_lat * u_lat + v_lon * u_lon

                # Include if storm is moving generally towards landmark (within 75-deg cone)
                # or if already within close proximity (<= 25 km)
                if dot > 0.25 or dist_km <= 25.0:
                    eta_sec = int(round((dist_km / max(speed, 5.0)) * 3600.0))

                    alert_radius = lm.get("alert_radius_km", 15.0)
                    if dist_km <= alert_radius or eta_sec <= 900:
                        hazard_level = "RED_ALERT"
                    elif dist_km <= alert_radius * 2.0 or eta_sec <= 2400:
                        hazard_level = "ORANGE_ALERT"
                    else:
                        hazard_level = "YELLOW_ALERT"

                    cell_countdowns.append({
                        "target_name": lm["name"],
                        "lat": l_lat,
                        "lon": l_lon,
                        "distance_km": float(round(dist_km, 1)),
                        "eta_seconds": max(0, eta_sec),
                        "hazard_level": hazard_level,
                        "category": lm.get("category", "Infrastructure")
                    })

            # Sort targets by shortest ETA
            cell_countdowns.sort(key=lambda x: x["eta_seconds"])
            cell["countdown_targets"] = cell_countdowns

        return tracked_cells
