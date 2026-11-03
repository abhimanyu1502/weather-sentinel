"""
Physics-Based Severe Storm Feature Extraction & Convective Initiation (CI) Detector.
Implements meteorologically calibrated formulas for CTCR, MESH, POSH, Marshall-Palmer Z-R, and Downbursts.
"""

import numpy as np
from scipy.ndimage import uniform_filter
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

@dataclass
class CIStatus:
    is_detected: bool
    confidence: float
    triggers: List[str]
    ctcr_k_per_15min: float
    min_tir1_k: float
    min_swd_k: float

@dataclass
class StormParameters:
    cell_id: str
    max_dbz: float
    min_tir1_k: float
    rain_rate_mm_hr: float
    is_cloudburst: bool
    cell_top_height_m: float
    vil_kg_m2: float
    hail_shi: float
    hail_mesh_mm: float
    hail_posh_pct: float
    is_severe_hail: bool
    downburst_divergence_ms: float
    downburst_gust_kmh: float
    is_downburst: bool
    lightning_flash_rate: float
    severity_level: str

def detect_ci(
    tir1_cur: np.ndarray,
    tir1_prev: Optional[np.ndarray],
    tir2_cur: np.ndarray,
    dbz: np.ndarray,
    dt_min: float = 15.0
) -> CIStatus:
    """
    Detects Convective Initiation (CI) precursors before heavy ground rainfall:
    1. Cloud-Top Cooling Rate (CTCR) <= -4.0 K/15min
    2. Split-Window Difference (SWD) <= +1.0 K (Ice glaciation)
    3. First radar echo Z >= 35 dBZ developing
    """
    triggers = []
    min_tir1 = float(np.min(tir1_cur))
    swd = tir1_cur - tir2_cur
    min_swd = float(np.min(swd))
    max_dbz = float(np.max(dbz))

    ctcr_val = 0.0
    if tir1_prev is not None:
        # Rate of cooling per 15 min
        cooling = (tir1_cur - tir1_prev) * (15.0 / max(dt_min, 1.0))
        ctcr_val = float(np.min(cooling))
        if ctcr_val <= -4.0:
            triggers.append(f"Rapid Cloud-Top Cooling: {ctcr_val:.1f} K/15min (<= -4.0 K)")

    if min_swd <= 1.0:
        triggers.append(f"Cloud Glaciation / Anvil SWD: {min_swd:.2f} K (<= 1.0 K)")

    if max_dbz >= 35.0:
        triggers.append(f"Radar First Echo Growth: {max_dbz:.1f} dBZ (>= 35.0 dBZ)")

    # Criteria: at least 2 triggers met, or rapid CTCR with cold cloud top
    is_detected = (len(triggers) >= 2) or (ctcr_val <= -6.0 and min_tir1 < 240.0)
    confidence = min(0.98, max(0.0, len(triggers) * 0.33 + (abs(ctcr_val) / 20.0 if ctcr_val < 0 else 0.0)))

    return CIStatus(
        is_detected=bool(is_detected),
        confidence=float(round(confidence, 2)),
        triggers=triggers,
        ctcr_k_per_15min=float(round(ctcr_val, 2)),
        min_tir1_k=float(round(min_tir1, 1)),
        min_swd_k=float(round(min_swd, 2))
    )

def compute_storm_params(
    dbz_patch: np.ndarray,
    vel_patch: np.ndarray,
    tir1_patch: np.ndarray,
    lightning_patch: np.ndarray,
    cell_id: str
) -> StormParameters:
    """
    Computes severe weather indices for an isolated storm cell.
    """
    max_z = float(np.max(dbz_patch))
    min_tir1 = float(np.min(tir1_patch))

    # 1. Z-R Tropical Rain Rate (Marshall-Palmer Tropical: Z = 300 * R^1.4)
    # R = (10^(Z/10) / 300)^(1 / 1.4)
    z_linear = 10.0 ** (max_z / 10.0)
    rain_rate = (z_linear / 300.0) ** (1.0 / 1.4)
    is_cloudburst = rain_rate >= 100.0

    # 2. Convective Cell Top Height from Standard Troposphere Lapse Rate (6.5 K/km)
    cell_top_m = max(0.0, (295.0 - min_tir1) / 6.5 * 1000.0)

    # 3. Vertically Integrated Liquid (VIL proxy)
    significant_z = dbz_patch[dbz_patch >= 20.0]
    if len(significant_z) > 0:
        vil = float(np.mean(3.44e-6 * (10.0 ** (significant_z / 10.0)) ** (4.0 / 7.0) * 10.0))
    else:
        vil = 0.0
    vil = min(85.0, vil)

    # 4. Severe Hail Index (SHI) & MESH / POSH
    # Freezing level over coastal/tropical India ~ 4500m
    h_above = max(0.0, cell_top_m - 4500.0)
    shi = vil * (h_above / 5000.0) * 0.15
    mesh_mm = 2.54 * np.sqrt(shi) if shi > 0 else 0.0
    posh_pct = min(100.0, 29.0 * np.log(2.54 * np.sqrt(shi) + 1.0) * 10.0) if shi > 0 else 0.0
    is_severe_hail = mesh_mm >= 25.0 or posh_pct >= 50.0

    # 5. Downburst / Microburst Divergence Velocity
    vel_smoothed = uniform_filter(vel_patch, size=3)
    delta_v = float(np.max(vel_smoothed) - np.min(vel_smoothed))
    gust_kmh = float(max(25.0, delta_v * 3.6 + (rain_rate * 0.15)))
    is_downburst = delta_v >= 25.0

    # 6. Lightning Flash Intensity
    flash_rate = float(np.sum(lightning_patch))

    # 7. Severity Classification
    if max_z >= 58.0 or is_cloudburst or mesh_mm >= 35.0 or gust_kmh >= 80.0:
        severity = "CRITICAL"
    elif max_z >= 48.0 or mesh_mm >= 20.0 or gust_kmh >= 60.0:
        severity = "HIGH"
    elif max_z >= 38.0:
        severity = "MODERATE"
    else:
        severity = "LOW"

    return StormParameters(
        cell_id=cell_id,
        max_dbz=float(round(max_z, 1)),
        min_tir1_k=float(round(min_tir1, 1)),
        rain_rate_mm_hr=float(round(rain_rate, 1)),
        is_cloudburst=bool(is_cloudburst),
        cell_top_height_m=float(round(cell_top_m, 0)),
        vil_kg_m2=float(round(vil, 1)),
        hail_shi=float(round(shi, 2)),
        hail_mesh_mm=float(round(mesh_mm, 1)),
        hail_posh_pct=float(round(posh_pct, 1)),
        is_severe_hail=bool(is_severe_hail),
        downburst_divergence_ms=float(round(delta_v, 1)),
        downburst_gust_kmh=float(round(gust_kmh, 1)),
        is_downburst=bool(is_downburst),
        lightning_flash_rate=float(round(flash_rate, 1)),
        severity_level=severity
    )
