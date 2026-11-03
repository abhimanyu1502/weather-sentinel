"""
run_ingestion.py — Executes an ingestion and data validation cycle across enabled sources.
Complies with Section 5 and Section 9 of SIH 26084 PRD.
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
    print("🛰️  Starting Multi-Source Weather Ingestion Run...")
    initialize_providers()

    target_loc = {"lat": 28.6139, "lon": 77.2090}
    observations = await registry.fetch_all(target_loc)

    print(f"\n✅ Ingested {len(observations)} sources successfully:")
    for obs in observations:
        print(f"  • {obs.source:<25} | Status: {obs.quality_status:<8} | Quality Score: {obs.data_quality_score:.2f}")

    print("\nIngestion cycle complete.")


if __name__ == "__main__":
    asyncio.run(main())
