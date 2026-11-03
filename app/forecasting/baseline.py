"""
0–6 Hour Convective Hazard Forecasting Engine.
Complies with Section 3.1, Section 19, and Section 42 of SIH 26084 PRD.
Generates an exact 7-step hourly prediction sequence: T+0, T+1, T+2, T+3, T+4, T+5, T+6.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import numpy as np
from app.schemas.forecast import SixHourForecast, HourlyPrediction
from app.schemas.hazard import SeverityLevel, HazardType
from app.hazard.thresholds import HazardThresholds


class ForecastGenerator:
    """
    Produces rolling 0-6 hour probabilistic hazard forecasts across T+0..T+6 steps.
    Calculates actual lead times to severe convective onset.
    """

    @classmethod
    def generate_6h_forecast(
        cls,
        current_assessment: Dict[str, Any],
        features: Dict[str, Any],
        lat: float,
        lon: float,
        grid_id: str = "GRID-TARGET",
        motion_vector: Optional[Dict[str, float]] = None
    ) -> SixHourForecast:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        # Extract current risk baseline
        tstorm_risk = current_assessment.get("thunderstorm", {}).get("risk", 0.1)
        hail_risk = current_assessment.get("hail", {}).get("risk", 0.05)
        burst_risk = current_assessment.get("cloudburst", {}).get("risk", 0.05)
        base_confidence = current_assessment.get("thunderstorm", {}).get("confidence", 0.75)

        rain_rate = features.get("precipitation", {}).get("rain_rate_mm_h", 0.0)
        dbz = features.get("radar", {}).get("max_reflectivity_dbz", 25.0)

        # Growth / Decay trajectory based on instability & stage
        cape = features.get("atmospheric", {}).get("cape_j_kg", 1200.0)
        growth_tendency = 0.08 if cape > 2000.0 else (-0.05 if cape < 800.0 else 0.02)

        predictions: List[HourlyPrediction] = []
        peak_risk = 0.0
        peak_severity = SeverityLevel.LOW
        primary_hazard: Optional[HazardType] = None
        event_start_step: Optional[int] = None

        # Build exactly 7 steps: T+0 through T+6 hours
        for step in range(7):
            valid_dt = now + timedelta(hours=step)
            lead_min = step * 60

            # Kinematic & thermodynamic evolution curve
            # Storms typically ramp up, peak around T+2 to T+4, then decay
            temporal_curve = np.exp(-((step - 2.5) ** 2) / 6.0)

            step_tstorm = min(1.0, max(0.05, round(tstorm_risk + (growth_tendency * step) * temporal_curve, 2)))
            step_hail = min(1.0, max(0.02, round(hail_risk + (growth_tendency * 0.8 * step) * temporal_curve, 2)))
            step_burst = min(1.0, max(0.02, round(burst_risk + (growth_tendency * 1.1 * step) * temporal_curve, 2)))

            # If current condition is a severe demo storm, preserve/advance its trajectory
            if tstorm_risk >= 0.70 or burst_risk >= 0.70:
                step_tstorm = min(1.0, max(0.1, round(tstorm_risk * (1.0 - step * 0.12), 2)))
                step_burst = min(1.0, max(0.05, round(burst_risk * (1.0 - step * 0.14), 2)))
                step_hail = min(1.0, max(0.02, round(hail_risk * (1.0 - step * 0.15), 2)))

            composite = max(step_tstorm, step_hail, step_burst)
            step_severity = HazardThresholds.get_severity(composite)

            # Confidence gradually decays with lead time (e.g. 0.90 at T+0 -> ~0.65 at T+6)
            step_conf = max(0.35, round(base_confidence * (1.0 - step * 0.05), 2))

            # Expected radar and rain rate projections
            expected_rain = round(rain_rate * (composite / max(0.1, tstorm_risk)), 1)
            expected_dbz = round(min(72.0, max(15.0, dbz + (composite - 0.3) * 20.0)), 1)

            pred = HourlyPrediction(
                timestep=step,
                valid_time=valid_dt.isoformat(),
                lead_time_minutes=lead_min,
                thunderstorm_probability=step_tstorm,
                hail_probability=step_hail,
                cloudburst_probability=step_burst,
                composite_risk_score=composite,
                severity=step_severity,
                confidence=step_conf,
                expected_rain_rate_mm_h=expected_rain,
                expected_radar_dbz=expected_dbz
            )
            predictions.append(pred)

            if composite > peak_risk:
                peak_risk = composite
                peak_severity = step_severity

            # Identify severe event onset
            if composite >= 0.65 and event_start_step is None:
                event_start_step = step

        # Determine dominant hazard
        max_ts = max(p.thunderstorm_probability for p in predictions)
        max_hail = max(p.hail_probability for p in predictions)
        max_cb = max(p.cloudburst_probability for p in predictions)
        if max_cb >= max_ts and max_cb >= max_hail:
            primary_hazard = HazardType.CLOUDBURST
        elif max_hail >= max_ts and max_hail >= max_cb:
            primary_hazard = HazardType.HAIL
        else:
            primary_hazard = HazardType.THUNDERSTORM

        # Lead time calculation
        lead_minutes = (event_start_step * 60) if event_start_step is not None else None
        lead_hours = round(lead_minutes / 60.0, 1) if lead_minutes is not None else None
        event_start_iso = (now + timedelta(minutes=lead_minutes)).isoformat() if lead_minutes is not None else None

        affected_cells = [grid_id, f"{grid_id}-EAST", f"{grid_id}-NORTHEAST"]

        return SixHourForecast(
            grid_id=grid_id,
            latitude=lat,
            longitude=lon,
            forecast_generated_at=now_iso,
            horizon_hours=6,
            event_start_estimate=event_start_iso,
            lead_time_minutes=lead_minutes,
            lead_time_hours=lead_hours,
            peak_severity=peak_severity,
            primary_hazard=primary_hazard,
            peak_risk_score=peak_risk,
            confidence=base_confidence,
            affected_grid_cells=affected_cells,
            predictions=predictions,
            explanation={
                "event_identified": event_start_step is not None,
                "onset_lead_hours": lead_hours,
                "growth_tendency": round(growth_tendency, 3),
                "cape_support": cape > 1500
            }
        )
