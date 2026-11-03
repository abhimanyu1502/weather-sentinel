"""
Domain-specific exceptions for meteorological validation, ingestion and forecasting.
"""


class WeatherNowcastException(Exception):
    """Base exception for all nowcasting domain exceptions."""
    pass


class IngestionError(WeatherNowcastException):
    """Raised when an external weather source fails to fetch or respond."""
    def __init__(self, provider: str, message: str):
        super().__init__(f"Ingestion failed for '{provider}': {message}")
        self.provider = provider


class DataQualityError(WeatherNowcastException):
    """Raised when meteorological observations violate physical plausibility checks."""
    def __init__(self, field: str, value: any, reason: str):
        super().__init__(f"Quality check rejected {field}={value}: {reason}")
        self.field = field
        self.value = value
        self.reason = reason


class ProviderUnavailableError(WeatherNowcastException):
    """Raised when a requested provider is disabled or completely unreachable."""
    def __init__(self, provider: str):
        super().__init__(f"Provider '{provider}' is disabled or currently offline.")
        self.provider = provider


class ForecastHorizonError(WeatherNowcastException):
    """Raised when forecast requested is outside 0-6 hour valid horizon."""
    pass
