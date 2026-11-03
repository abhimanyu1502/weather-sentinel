"""
Core application configuration using Pydantic Settings.
Complies with SIH 26084 PRD requirements.
"""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_ENV: str = "development"
    APP_NAME: str = "SIH26084-WeatherNowcast"
    APP_VERSION: str = "1.0.0"

    # Server settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True
    DEMO_MODE: bool = True
    DEMO_BROADCAST_INTERVAL_SEC: int = 3

    # Database & Cache
    DATABASE_URL: str = "sqlite+aiosqlite:///./weather_nowcast.db"
    POSTGRES_DATABASE_URL: Optional[str] = "postgresql+asyncpg://postgres:postgres@localhost:5432/weather_nowcast"
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_SQLITE_FALLBACK: bool = True

    # Ingestion & Forecasting Horizons
    API_TIMEOUT_SECONDS: int = 15
    INGESTION_INTERVAL_SECONDS: int = 300
    FORECAST_INTERVAL_SECONDS: int = 300
    MIN_WARNING_LEAD_MINUTES: int = 60
    TARGET_WARNING_LEAD_HOURS: int = 6

    # Spatial bounds & resolution
    DEFAULT_LAT: float = 26.8467
    DEFAULT_LON: float = 80.9462
    GRID_RESOLUTION_KM: float = 3.0
    GRID_H: int = 128
    GRID_W: int = 128
    DOMAIN_MIN_LAT: float = 6.0
    DOMAIN_MAX_LAT: float = 37.5
    DOMAIN_MIN_LON: float = 68.0
    DOMAIN_MAX_LON: float = 97.5

    # Thresholds
    REFLECTIVITY_STORM_THRESHOLD_DBZ: float = 38.0
    CLOUDBURST_RAIN_RATE_THRESHOLD_MM_H: float = 100.0
    SEVERE_HAIL_MESH_THRESHOLD_MM: float = 25.0
    DOWNBURST_GUST_THRESHOLD_KMH: float = 55.0
    CI_CTCR_THRESHOLD_K_PER_15MIN: float = -4.0

    # API Keys (all optional with graceful fallbacks)
    WEATHER_API_KEY: Optional[str] = None
    RADAR_API_KEY: Optional[str] = None
    SATELLITE_API_KEY: Optional[str] = None
    LIGHTNING_API_KEY: Optional[str] = None
    ADMIN_API_KEY: str = "sih2026-nowcast-admin-key"

    # Notification channels
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    ALERT_WEBHOOK_URL: Optional[str] = None

    # Logging
    LOG_LEVEL: str = "INFO"


settings = Settings()
