"""
Temporal Alignment Engine for multi-rate heterogeneous weather data.
Complies with Section 14 of SIH 26084 PRD.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import numpy as np
from app.schemas.weather import NormalizedWeatherObservation


class TemporalAligner:
    """
    Standardizes variable cadence feeds (1m, 5m, 10m, 15m, 30m, 60m)
    onto a unified timeline without unphysical long-horizon forward filling.
    """

    MAX_FORWARD_FILL_MINUTES = 30  # Do not forward-fill fast-changing variables beyond 30 min

    @classmethod
    def align_timeline(
        cls,
        observations: List[NormalizedWeatherObservation],
        target_timestamp: Optional[datetime] = None
    ) -> Dict[str, Any]:
        if not observations:
            return {"status": "NO_DATA", "aligned_at": datetime.now(timezone.utc).isoformat()}

        target = target_timestamp or datetime.now(timezone.utc)
        if target.tzinfo is None:
            target = target.replace(tzinfo=timezone.utc)

        valid_obs = []
        for obs in observations:
            t = obs.source_timestamp
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            delta = abs((target - t).total_seconds()) / 60.0

            # Only consider observations within acceptable window
            if delta <= cls.MAX_FORWARD_FILL_MINUTES:
                valid_obs.append((obs, delta))

        if not valid_obs:
            return {
                "status": "STALE_DATA",
                "target_time": target.isoformat(),
                "available_count": 0,
                "latest_observation": observations[-1]
            }

        # Sort by freshest
        valid_obs.sort(key=lambda x: x[1])
        return {
            "status": "ALIGNED",
            "target_time": target.isoformat(),
            "active_sources": [o.source for o, _ in valid_obs],
            "aligned_observations": [o for o, _ in valid_obs]
        }
