"""
Spatiotemporal Grid Alignment & Multimodal Tensor Normalization.
Standardizes heterogeneous radar, satellite, and lightning streams into a unified (5, H, W) tensor.
"""

import numpy as np
from scipy.ndimage import zoom
from typing import Dict, Any, Tuple

class GridAligner:
    def __init__(self, target_h: int = 128, target_w: int = 128):
        self.target_h = target_h
        self.target_w = target_w

    def _resize(self, arr: np.ndarray, target_shape: Tuple[int, int]) -> np.ndarray:
        """Bilinear resize to target dimensions."""
        if arr.shape == target_shape:
            return arr
        zoom_factors = (target_shape[0] / arr.shape[0], target_shape[1] / arr.shape[1])
        return zoom(arr, zoom_factors, order=1).astype(np.float32)

    def _normalize(self, arr: np.ndarray, mn: float, mx: float) -> np.ndarray:
        """Min-max normalize clipped to [0, 1]."""
        norm = (arr - mn) / (mx - mn + 1e-8)
        return np.clip(norm, 0.0, 1.0).astype(np.float32)

    def align(
        self,
        dbz: np.ndarray,
        tir1: np.ndarray,
        tir2: np.ndarray,
        lightning_density: np.ndarray,
        velocity: np.ndarray
    ) -> np.ndarray:
        """
        Aligns and normalizes 5 physical channels into (5, target_h, target_w):
        0: Radar Reflectivity Z (dBZ) [0, 75]
        1: Inverted Satellite TIR-1 (colder = higher values) [185, 315] K
        2: Split-Window Difference (TIR-1 - TIR-2) [-10, 15] K
        3: Lightning Density KDE [0, 1]
        4: Doppler Radial Velocity [-30, 30] m/s
        """
        target = (self.target_h, self.target_w)

        ch0 = self._normalize(self._resize(dbz, target), 0.0, 75.0)
        ch1 = 1.0 - self._normalize(self._resize(tir1, target), 185.0, 315.0)
        swd = tir1 - tir2
        ch2 = self._normalize(self._resize(swd, target), -10.0, 15.0)
        ch3 = self._resize(lightning_density, target)
        ch4 = self._normalize(self._resize(velocity, target), -30.0, 30.0)

        tensor = np.stack([ch0, ch1, ch2, ch3, ch4], axis=0).astype(np.float32)
        return tensor
