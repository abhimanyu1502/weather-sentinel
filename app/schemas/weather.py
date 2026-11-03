"""
Pydantic schemas for canonical weather observations and quality control.
Strictly compliant with Section 12 of SIH 26084 PRD.
"""

from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field


class NormalizedWeatherObservation(BaseModel):
    source: str = Field(..., description="Provider identifier, e.g. open-meteo, imd, radar, insat")
    source_timestamp: datetime = Field(..., description="Observation timestamp reported by sensor/source (UTC)")
    ingested_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Ingestion timestamp (UTC)")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    altitude: Optional[float] = Field(None, description="Altitude in meters MSL")

    # Surface thermodynamics
    temperature_c: Optional[float] = Field(None, ge=-60.0, le=60.0)
    dew_point_c: Optional[float] = Field(None, ge=-60.0, le=50.0)
    relative_humidity: Optional[float] = Field(None, ge=0.0, le=100.0)
    surface_pressure_hpa: Optional[float] = Field(None, ge=800.0, le=1100.0)

    # Wind
    wind_speed_ms: Optional[float] = Field(None, ge=0.0, le=150.0)
    wind_direction_deg: Optional[float] = Field(None, ge=0.0, le=360.0)
    wind_gust_ms: Optional[float] = Field(None, ge=0.0, le=180.0)

    # Precipitation
    precipitation_mm: Optional[float] = Field(None, ge=0.0)
    precipitation_rate_mm_h: Optional[float] = Field(None, ge=0.0)

    # Cloud & visibility
    cloud_cover_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    visibility_km: Optional[float] = Field(None, ge=0.0)

    # Remote sensing / Radar / Satellite / Lightning
    lightning_count: Optional[int] = Field(None, ge=0)
    radar_reflectivity_dbz: Optional[float] = Field(None, ge=-20.0, le=85.0)
    radar_velocity_ms: Optional[float] = Field(None, ge=-100.0, le=100.0)
    satellite_cloud_top_temperature_c: Optional[float] = Field(None, ge=-110.0, le=50.0)

    # Convective / Instability metrics
    cape_j_kg: Optional[float] = Field(None, ge=0.0, le=8000.0)
    cin_j_kg: Optional[float] = Field(None, ge=0.0, le=2000.0)
    lifted_index: Optional[float] = Field(None, ge=-25.0, le=35.0)
    vertical_wind_shear: Optional[float] = Field(None, ge=0.0, le=100.0)

    # Quality control
    data_quality_score: float = Field(1.0, ge=0.0, le=1.0)
    quality_status: str = Field("PASSED", description="PASSED | FLAGGED | REJECTED")
    validation_errors: List[str] = Field(default_factory=list)


class CurrentConditionsResponse(BaseModel):
    location: dict
    observation: NormalizedWeatherObservation
    source_attribution: str
