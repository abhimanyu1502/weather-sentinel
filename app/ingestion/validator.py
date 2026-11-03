"""
Meteorological Quality Control and Physical Plausibility Validator.
Complies with Section 13 of SIH 26084 PRD.
"""

from datetime import datetime, timezone, timedelta
from typing import Tuple, List
from app.schemas.weather import NormalizedWeatherObservation


class ObservationValidator:
    """
    Validates physical consistency and plausibility of weather observations.
    Rejects or flags physically impossible measurements and calculates a data quality score.
    """

    MAX_TIMESTAMP_FUTURE_SECONDS = 300  # Allow up to 5 min clock drift
    MAX_TIMESTAMP_STALE_HOURS = 6       # Flag data older than 6 hours as stale

    @classmethod
    def validate(cls, obs: NormalizedWeatherObservation) -> Tuple[str, float, List[str]]:
        errors: List[str] = []
        score = 1.0
        status = "PASSED"

        now = datetime.now(timezone.utc)
        obs_time = obs.source_timestamp
        if obs_time.tzinfo is None:
            obs_time = obs_time.replace(tzinfo=timezone.utc)

        # 1. Temporal plausibility
        if obs_time > now + timedelta(seconds=cls.MAX_TIMESTAMP_FUTURE_SECONDS):
            errors.append("Future timestamp detected")
            score -= 0.5
            status = "REJECTED"

        if obs_time < now - timedelta(hours=cls.MAX_TIMESTAMP_STALE_HOURS):
            errors.append("Stale timestamp (>6h old)")
            score -= 0.3
            status = "FLAGGED"

        # 2. Temperature (-50C to +55C in Indian subcontinent)
        if obs.temperature_c is not None:
            if obs.temperature_c < -50.0 or obs.temperature_c > 55.0:
                errors.append(f"Temperature out of physical bounds: {obs.temperature_c}°C")
                score -= 0.4
                status = "FLAGGED"

        # 3. Relative Humidity (0 to 100%)
        if obs.relative_humidity is not None:
            if obs.relative_humidity < 0.0 or obs.relative_humidity > 100.0:
                errors.append(f"Relative humidity out of physical bounds: {obs.relative_humidity}%")
                score -= 0.3
                status = "FLAGGED"

        # 4. Wind speed and gust
        if obs.wind_speed_ms is not None:
            if obs.wind_speed_ms < 0.0:
                errors.append(f"Negative wind speed: {obs.wind_speed_ms} m/s")
                score -= 0.3
                status = "FLAGGED"

        if obs.wind_direction_deg is not None:
            if obs.wind_direction_deg < 0.0 or obs.wind_direction_deg > 360.0:
                errors.append(f"Wind direction out of 0-360 range: {obs.wind_direction_deg}°")
                score -= 0.2

        if obs.wind_gust_ms is not None and obs.wind_speed_ms is not None:
            if obs.wind_gust_ms < obs.wind_speed_ms:
                errors.append(f"Gust ({obs.wind_gust_ms} m/s) is lower than sustained wind ({obs.wind_speed_ms} m/s)")
                score -= 0.1

        # 5. Precipitation
        if obs.precipitation_mm is not None and obs.precipitation_mm < 0.0:
            errors.append(f"Negative precipitation accumulation: {obs.precipitation_mm} mm")
            score -= 0.4
            status = "FLAGGED"

        if obs.precipitation_rate_mm_h is not None and obs.precipitation_rate_mm_h < 0.0:
            errors.append(f"Negative precipitation rate: {obs.precipitation_rate_mm_h} mm/h")
            score -= 0.4
            status = "FLAGGED"

        # 6. Radar Reflectivity (-15 to 85 dBZ)
        if obs.radar_reflectivity_dbz is not None:
            if obs.radar_reflectivity_dbz < -15.0 or obs.radar_reflectivity_dbz > 85.0:
                errors.append(f"Reflectivity out of range: {obs.radar_reflectivity_dbz} dBZ")
                score -= 0.2

        final_score = max(0.0, min(1.0, round(score, 2)))
        if final_score < 0.4:
            status = "REJECTED"
        elif final_score < 0.8 and status == "PASSED":
            status = "FLAGGED"

        return status, final_score, errors
