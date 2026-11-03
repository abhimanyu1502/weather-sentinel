"""
Lightning Density Ingestion & KDE Grid Generation.
"""

import numpy as np
import pandas as pd
from scipy.ndimage import gaussian_filter

def generate_lightning_density_grid(
    strokes_df: pd.DataFrame,
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    grid_h: int,
    grid_w: int,
    sigma: float = 2.0
) -> np.ndarray:
    """
    Converts individual lightning stroke points into a continuous 2D KDE density grid.
    Weighted by peak stroke amplitude (kA).
    """
    grid = np.zeros((grid_h, grid_w), dtype=np.float32)
    if strokes_df is None or len(strokes_df) == 0:
        return grid

    # Filter within domain
    df = strokes_df[
        (strokes_df["lat"] >= min_lat) & (strokes_df["lat"] <= max_lat) &
        (strokes_df["lon"] >= min_lon) & (strokes_df["lon"] <= max_lon)
    ]
    if len(df) == 0:
        return grid

    # Convert coordinates to pixel rows (top-down) and cols (left-right)
    row_indices = np.clip(
        np.round(((max_lat - df["lat"].values) / (max_lat - min_lat)) * (grid_h - 1)).astype(int),
        0, grid_h - 1
    )
    col_indices = np.clip(
        np.round(((df["lon"].values - min_lon) / (max_lon - min_lon)) * (grid_w - 1)).astype(int),
        0, grid_w - 1
    )
    weights = np.maximum(df["amplitude_ka"].values, 1.0) / 50.0  # normalize weight scale

    for r, c, w in zip(row_indices, col_indices, weights):
        grid[r, c] += w

    # Apply Gaussian KDE smoothing
    smoothed = gaussian_filter(grid, sigma=sigma)
    max_val = np.max(smoothed)
    if max_val > 0:
        smoothed = smoothed / max_val

    return smoothed.astype(np.float32)
