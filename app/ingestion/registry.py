"""
ProviderRegistry for multi-source weather ingestion orchestration.
Complies with Section 10 of SIH 26084 PRD.
"""

from typing import Dict, List, Optional, Any
from loguru import logger
from app.ingestion.base import WeatherProvider
from app.schemas.weather import NormalizedWeatherObservation


class ProviderRegistry:
    """
    Manages all registered weather source adapters, their health states,
    priorities, and dynamic enabling/disabling without restarting the server.
    """

    def __init__(self):
        self._providers: Dict[str, WeatherProvider] = {}

    def register(self, provider: WeatherProvider):
        self._providers[provider.name] = provider
        logger.info(f"Registered weather provider: '{provider.name}' (enabled={provider.enabled}, priority={provider.priority})")

    def get(self, name: str) -> Optional[WeatherProvider]:
        return self._providers.get(name)

    def list_all(self) -> List[WeatherProvider]:
        return list(self._providers.values())

    def list_enabled(self) -> List[WeatherProvider]:
        enabled = [p for p in self._providers.values() if p.enabled]
        # Sort by priority (ascending: 0=demo, 1=primary, 2=backup)
        return sorted(enabled, key=lambda p: p.priority)

    def enable(self, name: str) -> bool:
        provider = self.get(name)
        if provider:
            provider.enabled = True
            logger.info(f"Provider '{name}' enabled.")
            return True
        return False

    def disable(self, name: str) -> bool:
        provider = self.get(name)
        if provider:
            provider.enabled = False
            logger.info(f"Provider '{name}' disabled.")
            return True
        return False

    async def health_check_all(self) -> Dict[str, Any]:
        results = {}
        for name, provider in self._providers.items():
            try:
                results[name] = await provider.health_check()
            except Exception as e:
                results[name] = {
                    "provider": name,
                    "status": "ERROR",
                    "healthy": False,
                    "error": str(e)
                }
        return results

    async def fetch_all(self, location: Dict[str, float]) -> List[NormalizedWeatherObservation]:
        """
        Attempts ingestion across all enabled providers.
        Isolates failures so a single provider error never crashes the pipeline.
        """
        observations: List[NormalizedWeatherObservation] = []
        for provider in self.list_enabled():
            try:
                obs = await provider.fetch_current(location)
                observations.append(obs)
            except Exception as e:
                logger.error(f"Provider '{provider.name}' failed during fetch: {e}")
                # Failure isolated, gracefully continue with remaining sources
        return observations


# Global registry singleton
registry = ProviderRegistry()
