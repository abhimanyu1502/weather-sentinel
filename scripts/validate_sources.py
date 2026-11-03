"""
validate_sources.py — Comprehensive Data Source and Health Diagnostics.
Complies with Section 5 and Section 50 of SIH 26084 PRD.
"""

import sys
import asyncio
from pathlib import Path

# Ensure Windows terminal doesn't crash on UTF-8 emojis
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.ingestion.registry import registry
from app.main import initialize_providers


async def main():
    print("=" * 65)
    print("🔍 SIH 26084 — Meteorological Data Source Validator")
    print("=" * 65)
    initialize_providers()

    statuses = await registry.health_check_all()

    for name, st in statuses.items():
        state_icon = "✅" if st.get("healthy") else "❌"
        print(f"{state_icon} {name:<26} | Status: {st.get('status'):<12} | Mode: {st.get('mode', 'N/A')}")
        if "latency_ms" in st:
            print(f"   Latency: {st['latency_ms']} ms | HTTP: {st.get('http_status')}")

    print("=" * 65)
    print("All configured data sources validated.\n")


if __name__ == "__main__":
    asyncio.run(main())
