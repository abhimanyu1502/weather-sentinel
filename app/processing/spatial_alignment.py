"""
Spatial Alignment & Hyper-Local Grid Projection Engine (1–3 km / 5 km).
Complies with Section 15 of SIH 26084 PRD.
"""

import math
from typing import Dict, Any, List, Tuple
from shapely.geometry import Point, box, mapping


class SpatialGridManager:
    """
    Manages spatial discretization of monitored domains into 1–3 km / 5 km resolution cells.
    Reprojects point observations and spatial polygons onto canonical grid IDs.
    """

    def __init__(self, resolution_km: float = 3.0):
        self.resolution_km = resolution_km
        # Approximately 1 degree of latitude ≈ 111.32 km
        self.lat_step = resolution_km / 111.32
        # Longitude step varies with latitude, calculated dynamically

    def get_grid_cell_id(self, lat: float, lon: float) -> str:
        """Computes deterministic, canonical grid cell ID e.g. 'GRID-3KM-28.61-77.21'"""
        rounded_lat = round(round(lat / self.lat_step) * self.lat_step, 4)
        lon_step = self.resolution_km / (111.32 * math.cos(math.radians(lat)))
        rounded_lon = round(round(lon / lon_step) * lon_step, 4)
        return f"GRID-{int(self.resolution_km)}KM-{rounded_lat:.2f}-{rounded_lon:.2f}"

    def get_cell_polygon(self, lat: float, lon: float) -> Dict[str, Any]:
        """Returns the GeoJSON polygon representing the 1-3km grid footprint."""
        half_lat = self.lat_step / 2.0
        lon_step = self.resolution_km / (111.32 * math.cos(math.radians(lat)))
        half_lon = lon_step / 2.0

        b = box(lon - half_lon, lat - half_lat, lon + half_lon, lat + half_lat)
        return mapping(b)

    def generate_regional_grid(
        self,
        min_lat: float,
        max_lat: float,
        min_lon: float,
        max_lon: float,
        max_cells: int = 100
    ) -> List[Dict[str, Any]]:
        """Generates regional mesh cells for hyper-local hazard mapping."""
        cells = []
        cur_lat = min_lat
        count = 0

        while cur_lat <= max_lat and count < max_cells:
            lon_step = self.resolution_km / (111.32 * math.cos(math.radians(cur_lat)))
            cur_lon = min_lon
            while cur_lon <= max_lon and count < max_cells:
                grid_id = self.get_grid_cell_id(cur_lat, cur_lon)
                poly = self.get_cell_polygon(cur_lat, cur_lon)
                cells.append({
                    "grid_id": grid_id,
                    "latitude": round(cur_lat, 4),
                    "longitude": round(cur_lon, 4),
                    "geometry": poly
                })
                count += 1
                cur_lon += lon_step * 2.0  # Sample grid evenly
            cur_lat += self.lat_step * 2.0

        return cells


spatial_grid = SpatialGridManager(resolution_km=3.0)
