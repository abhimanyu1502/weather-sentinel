"""
test_backend_correctness.py — Universal Backend & System Correctness Validator.

Run this script to verify:
  1. Python environment and installed libraries
  2. Physics Engine (Convective Initiation & Severe Weather Indices)
  3. 5-Channel Spatiotemporal Radar/Satellite Tensor Fusion
  4. Storm Cell Tracking, Haversine Kinematics & ETA Countdowns
  5. Machine Learning ConvLSTM Nowcasting Engine
  6. Live FastAPI REST Backend & Sensor Health Checks
  7. Real-Time Weather API Ingestion & 6-Hour Anomaly Prediction Engine

Usage:
  python test_backend_correctness.py
"""

import sys
import subprocess
from pathlib import Path

# Ensure UTF-8 output on Windows terminals
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
VENV_PYTHON = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"

# Select python binary (prefer backend venv if present, else sys.executable)
python_exe = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

print(f"\n============================================================")
print(f"🔬 AntiGravity Comprehensive Correctness Validator")
print(f"🐍 Python Executable: {python_exe}")
print(f"📁 Root Directory: {ROOT_DIR}")
print(f"============================================================\n")

runner_script = BACKEND_DIR / "tests" / "validation" / "run_all_checks.py"

try:
    result = subprocess.run([python_exe, str(runner_script)], cwd=str(ROOT_DIR), check=True)
    print("\n✅ Verification completed successfully. All components are operational!\n")
    sys.exit(0)
except subprocess.CalledProcessError as e:
    print(f"\n❌ Validation suite failed with exit code {e.returncode}\n")
    sys.exit(e.returncode)
