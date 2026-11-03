"""
WeatherProvider Abstract Base Class.
Complies with Section 9 of SIH 26084 PRD.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from app.schemas.weather import NormalizedWeatherObservation


class WeatherProvider(ABC):
    """
    Standard interface that every weather data provider adapter must implement.
    The core nowcasting engine never interacts directly with raw vendor payloads.
    """

    def __init__(self, name: str, enabled: bool = True, priority: int = 1, reliability: float = 0.9):
        self.name = name
        self.enabled = enabled
        self.priority = priority
        self.reliability = reliability
        self.last_healthy_at: Optional[datetime] = None
        self.is_healthy: bool = True
        self.failure_count: int = 0
        self.last_error: Optional[str] = None

    @abstractmethod
    async def fetch_current(self, location: Dict[str, float]) -> NormalizedWeatherObservation:
        """
        Fetch and normalize current surface/remote observations for given lat/lon.
        Must return canonical NormalizedWeatherObservation.
        """
        pass

    @abstractmethod
    async def fetch_forecast(self, location: Dict[str, float]) -> Dict[str, Any]:
        """
        Fetch raw 0-6 hour forecast telemetry for given coordinates.
        """
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """
        Verify provider connectivity, latency, and status.
        """
        pass

    def mark_success(self):
        self.is_healthy = True
        self.failure_count = 0
        self.last_healthy_at = datetime.now(timezone.utc)
        self.last_error = None

    def mark_failure(self, error_message: str):
        self.failure_count += 1
        self.last_error = error_message
        if self.failure_count >= 3:
            self.is_healthy = False
