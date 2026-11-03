from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List, Dict, Any

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    APP_NAME: str = "AntiGravity"
    APP_VERSION: str = "3.0.0"
    DEBUG: bool = True
    DOMAIN_MIN_LAT: float = 6.0
    DOMAIN_MAX_LAT: float = 37.5
    DOMAIN_MIN_LON: float = 68.0
    DOMAIN_MAX_LON: float = 97.5
    GRID_RESOLUTION_KM: float = 1.0
    GRID_HEIGHT: int = 128
    GRID_WIDTH: int = 128
    REDIS_URL: str = "redis://localhost:6379/0"
    DB_PASSWORD: str = "antigravity_secure_2024"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    MODEL_CHECKPOINT_PATH: str = "models/checkpoints/convlstm_nowcaster.pt"
    INFERENCE_DEVICE: str = "cpu"
    GRID_H: int = 128
    GRID_W: int = 128
    CI_DETECTION_COOLING_RATE_K: float = -4.0
    CLOUDBURST_RAIN_RATE_MM_HR: float = 100.0
    DOWNBURST_DIVERGENCE_MS: float = 25.0
    HAIL_MESH_SEVERE_MM: float = 25.0
    REFLECTIVITY_STORM_THRESHOLD_DBZ: float = 38.0
    MIN_STORM_AREA_KM2: float = 12.0
    DEMO_MODE: bool = True
    DEMO_BROADCAST_INTERVAL_SEC: int = 3
    MOSDAC_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    NVIDIA_API_KEY: Optional[str] = None

settings = Settings()
