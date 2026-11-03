"""
Source A: Open-Meteo Open Atmospheric & Convective Telemetry Provider.
Fetches live surface telemetry, dew points, pressure, and CAPE instability indices.
"""

import httpx
from datetime import datetime, timezone
from typing import Dict, Any
from app.ingestion.base import WeatherProvider
from app.schemas.weather import NormalizedWeatherObservation
from app.ingestion.validator import ObservationValidator
from app.ingestion.retry import CircuitBreaker, execute_with_retry


class SourceAProvider(WeatherProvider):
    def __init__(self, enabled: bool = True):
        super().__init__(name="source_a_open_meteo", enabled=enabled, priority=1, reliability=0.92)
        self.breaker = CircuitBreaker(failure_threshold=4, recovery_timeout=45.0)

    async def fetch_current(self, location: Dict[str, float]) -> NormalizedWeatherObservation:
        lat = location.get("lat", 28.6139)
        lon = location.get("lon", 77.2090)

        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,"
            f"surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover"
            f"&hourly=cape,precipitation_probability,precipitation&forecast_hours=7"
        )

        async def _call():
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.json()

        try:
            data = await execute_with_retry(_call, retries=2, circuit_breaker=self.breaker)
            self.mark_success()

            curr = data.get("current", {})
            hourly = data.get("hourly", {})
            capes = hourly.get("cape", [])
            cape_val = float(capes[0]) if capes else None

            temp_c = curr.get("temperature_2m")
            dew_c = curr.get("dew_point_2m")
            rh = curr.get("relative_humidity_2m")
            pressure = curr.get("surface_pressure")
            precip = curr.get("precipitation", 0.0)
            wind_kmh = curr.get("wind_speed_10m", 0.0)
            gust_kmh = curr.get("wind_gusts_10m", 0.0)

            # Convert km/h to m/s
            wind_ms = round(wind_kmh / 3.6, 2) if wind_kmh is not None else None
            gust_ms = round(gust_kmh / 3.6, 2) if gust_kmh is not None else None

            obs = NormalizedWeatherObservation(
                source=self.name,
                source_timestamp=datetime.now(timezone.utc),
                latitude=lat,
                longitude=lon,
                temperature_c=temp_c,
                dew_point_c=dew_c,
                relative_humidity=rh,
                surface_pressure_hpa=pressure,
                wind_speed_ms=wind_ms,
                wind_direction_deg=curr.get("wind_direction_10m"),
                wind_gust_ms=gust_ms,
                precipitation_mm=precip,
                precipitation_rate_mm_h=precip,
                cloud_cover_pct=curr.get("cloud_cover"),
                cape_j_kg=cape_val
            )

            status, score, errors = ObservationValidator.validate(obs)
            obs.quality_status = status
            obs.data_quality_score = score
            obs.validation_errors = errors
            return obs

        except Exception as e:
            self.mark_failure(str(e))
            raise

    async def fetch_forecast(self, location: Dict[str, float]) -> Dict[str, Any]:
        lat = location.get("lat", 28.6139)
        lon = location.get("lon", 77.2090)
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=cape,precipitation,precipitation_probability,wind_gusts_10m&forecast_hours=7"
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    async def health_check(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get("https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&current=temperature_2m")
                is_ok = res.status_code == 200
                if is_ok:
                    self.mark_success()
                return {
                    "provider": self.name,
                    "status": "OPERATIONAL" if is_ok else "DEGRADED",
                    "http_status": res.status_code,
                    "latency_ms": round(res.elapsed.total_seconds() * 1000, 1),
                    "healthy": is_ok
                }
        except Exception as e:
            self.mark_failure(str(e))
            return {
                "provider": self.name,
                "status": "OFFLINE",
                "healthy": False,
                "error": str(e)
            }
