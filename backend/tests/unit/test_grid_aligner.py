"""
Unit tests for 5-Channel Spatiotemporal Tensor Fusion & Alignment.
"""

import sys
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np
from pipelines.fusion.grid_aligner import GridAligner

def test_grid_aligner_output_tensor():
    aligner = GridAligner(target_h=128, target_w=128)

    dbz = np.random.uniform(0, 75, (128, 128)).astype(np.float32)
    tir1 = np.random.uniform(185, 315, (64, 64)).astype(np.float32)
    tir2 = np.random.uniform(180, 315, (64, 64)).astype(np.float32)
    lightning = np.random.uniform(0, 1, (128, 128)).astype(np.float32)
    velocity = np.random.uniform(-30, 30, (128, 128)).astype(np.float32)

    tensor = aligner.align(dbz, tir1, tir2, lightning, velocity)

    assert tensor.shape == (5, 128, 128)
    assert np.min(tensor) >= 0.0
    assert np.max(tensor) <= 1.0
    print("✅ test_grid_aligner_output_tensor passed!")

if __name__ == "__main__":
    test_grid_aligner_output_tensor()
