"""
REST API Endpoints for AntiGravity Pan-India Severe Weather Platform.
"""

from fastapi import APIRouter, Response, Query, Path
from starlette.concurrency import run_in_threadpool
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
import time

try:
    from config.settings import settings
except ImportError:
    from backend.config.settings import settings

try:
    from services.ai_advisory import generate_meteorological_advisory
except ImportError:
    from backend.services.ai_advisory import generate_meteorological_advisory

router = APIRouter(prefix="/api")

# 6 Pan-India Regional Radar Domains + National Overview
PAN_INDIA_REGIONS = [
    {"id": "ALL_INDIA", "name": "🇮🇳 National Overview (Pan-India)", "center": [78.9629, 21.5937], "zoom": 4.8, "bounds": [6.0, 37.5, 68.0, 97.5]},
    {"id": "WEST_INDIA", "name": "⚡ Western India & Ghats (Mumbai/Pune/Goa)", "center": [73.2, 19.2], "zoom": 7.2, "bounds": [15.0, 24.0, 70.0, 78.0]},
    {"id": "NORTH_INDIA", "name": "🏔️ Northern Plains & Himalayas (Delhi/UK)", "center": [77.2090, 28.6139], "zoom": 7.2, "bounds": [25.0, 33.0, 74.0, 81.0]},
    {"id": "EAST_INDIA", "name": "🌊 Eastern & Bay of Bengal (Kolkata/Odisha)", "center": [88.3639, 22.5726], "zoom": 7.2, "bounds": [18.0, 27.0, 83.0, 92.0]},
    {"id": "SOUTH_INDIA", "name": "🌴 Southern Peninsula (BLR/HYD/MAA)", "center": [77.5946, 12.9716], "zoom": 7.2, "bounds": [8.0, 18.0, 73.0, 83.0]},
    {"id": "NORTHWEST", "name": "🏜️ Northwest Desert & Plains (Jaipur/Punjab)", "center": [73.5, 27.0], "zoom": 6.8, "bounds": [23.0, 31.0, 69.0, 77.0]},
    {"id": "NORTHEAST", "name": "🌿 North-Eastern Hills (Guwahati/Shillong)", "center": [92.0, 26.0], "zoom": 7.0, "bounds": [23.0, 29.0, 89.0, 97.0]}
]

LANDMARKS = [
    # Western India
    {"name": "Mumbai Airport (CSMIA)", "lat": 19.0896, "lon": 72.8656, "category": "Airport", "region": "WEST_INDIA", "alert_radius_km": 12.0},
    {"name": "Mumbai Central Station", "lat": 18.9692, "lon": 72.8247, "category": "Railway", "region": "WEST_INDIA", "alert_radius_km": 8.0},
    {"name": "BKC Commercial Hub", "lat": 19.0660, "lon": 72.8650, "category": "Commercial", "region": "WEST_INDIA", "alert_radius_km": 8.0},
    {"name": "Thane City Junction", "lat": 19.2183, "lon": 72.9781, "category": "Urban", "region": "WEST_INDIA", "alert_radius_km": 12.0},
    {"name": "Pune Central Station", "lat": 18.5289, "lon": 73.8744, "category": "Railway", "region": "WEST_INDIA", "alert_radius_km": 12.0},
    {"name": "Surat Airport", "lat": 21.1139, "lon": 72.7419, "category": "Airport", "region": "WEST_INDIA", "alert_radius_km": 12.0},
    {"name": "Ahmedabad Sardar Patel Airport", "lat": 23.0772, "lon": 72.6347, "category": "Airport", "region": "WEST_INDIA", "alert_radius_km": 12.0},
    {"name": "Goa Mopa Airport", "lat": 15.7583, "lon": 73.8683, "category": "Airport", "region": "WEST_INDIA", "alert_radius_km": 10.0},

    # Northern India & Himalayan Belt
    {"name": "Delhi IGI Airport (DEL)", "lat": 28.5562, "lon": 77.1000, "category": "Airport", "region": "NORTH_INDIA", "alert_radius_km": 15.0},
    {"name": "New Delhi Railway Station", "lat": 28.6429, "lon": 77.2195, "category": "Railway", "region": "NORTH_INDIA", "alert_radius_km": 10.0},
    {"name": "Noida Cyber City", "lat": 28.5355, "lon": 77.3910, "category": "Commercial", "region": "NORTH_INDIA", "alert_radius_km": 10.0},
    {"name": "Dehradun Jolly Grant Airport", "lat": 30.1897, "lon": 78.1803, "category": "Airport", "region": "NORTH_INDIA", "alert_radius_km": 14.0},
    {"name": "Kedarnath Valley", "lat": 30.7346, "lon": 79.0669, "category": "Hill Station", "region": "NORTH_INDIA", "alert_radius_km": 15.0},
    {"name": "Shimla Ridge", "lat": 31.1048, "lon": 77.1734, "category": "Hill Station", "region": "NORTH_INDIA", "alert_radius_km": 12.0},
    {"name": "Chandigarh Airport", "lat": 30.6735, "lon": 76.7885, "category": "Airport", "region": "NORTH_INDIA", "alert_radius_km": 12.0},

    # Eastern & North-Eastern India
    {"name": "Kolkata Netaji Subhash Airport (CCU)", "lat": 22.6547, "lon": 88.4467, "category": "Airport", "region": "EAST_INDIA", "alert_radius_km": 14.0},
    {"name": "Howrah Junction", "lat": 22.5839, "lon": 88.3426, "category": "Railway", "region": "EAST_INDIA", "alert_radius_km": 10.0},
    {"name": "Bhubaneswar Biju Patnaik Airport", "lat": 20.2444, "lon": 85.8178, "category": "Airport", "region": "EAST_INDIA", "alert_radius_km": 12.0},
    {"name": "Patna Jayprakash Airport", "lat": 25.5913, "lon": 85.0880, "category": "Airport", "region": "EAST_INDIA", "alert_radius_km": 10.0},

    # Southern Peninsula
    {"name": "Bengaluru Kempegowda Airport (BLR)", "lat": 13.1986, "lon": 77.7066, "category": "Airport", "region": "SOUTH_INDIA", "alert_radius_km": 15.0},
    {"name": "Bengaluru Electronic City", "lat": 12.8399, "lon": 77.6770, "category": "Commercial", "region": "SOUTH_INDIA", "alert_radius_km": 10.0},
    {"name": "Chennai International Airport (MAA)", "lat": 12.9941, "lon": 80.1709, "category": "Airport", "region": "SOUTH_INDIA", "alert_radius_km": 14.0},
    {"name": "Hyderabad Rajiv Gandhi Airport (HYD)", "lat": 17.2403, "lon": 78.4294, "category": "Airport", "region": "SOUTH_INDIA", "alert_radius_km": 14.0},
    {"name": "Kochi International Airport (COK)", "lat": 10.1556, "lon": 76.3908, "category": "Airport", "region": "SOUTH_INDIA", "alert_radius_km": 12.0},
    {"name": "Wayanad Foothills", "lat": 11.6854, "lon": 76.1320, "category": "Hill Station", "region": "SOUTH_INDIA", "alert_radius_km": 15.0},

    # Northwest & Northeast
    {"name": "Jaipur International Airport", "lat": 26.8242, "lon": 75.8122, "category": "Airport", "region": "NORTHWEST", "alert_radius_km": 14.0},
    {"name": "Guwahati Lokpriya Gopinath Airport", "lat": 26.1061, "lon": 91.5859, "category": "Airport", "region": "NORTHEAST", "alert_radius_km": 14.0},
    {"name": "Shillong Peak", "lat": 25.5348, "lon": 91.8542, "category": "Hill Station", "region": "NORTHEAST", "alert_radius_km": 12.0}
]

HISTORICAL_EVENTS = [
    {
        "event_id": "MUMBAI_2005",
        "title": "26 July 2005 Mumbai Super-Cloudburst",
        "date": "2005-07-26",
        "peak_rain_mm_hr": 190.0,
        "total_24h_mm": 944.0,
        "synopsis": "Mesoscale convective vortex trapped against Western Ghats topography triggering catastrophic urban deluge."
    },
    {
        "event_id": "KEDARNATH_2013",
        "title": "June 2013 Himalayan Cloudburst Complex",
        "date": "2013-06-16",
        "peak_rain_mm_hr": 145.0,
        "total_24h_mm": 375.0,
        "synopsis": "Orographic multi-cell merging with rapid glacier lake outburst and flash flooding across Mandakini valley."
    },
    {
        "event_id": "NORWESTER_2018",
        "title": "May 2018 Northern Plains Squall & Dust Downburst",
        "date": "2018-05-02",
        "peak_gust_kmh": 126.0,
        "synopsis": "Severe linear squall line with extreme cold-pool velocity divergence spreading across UP and Rajasthan."
    }
]

# Shared state container
state_container: Dict[str, Any] = {
    "current_state": {},
    "regions_state": {},
    "sim_t": 0,
    "active_region": "WEST_INDIA",
    "radar_offline_mode": False
}

# Map clicks are coordinate-first. Cache nearby repeat queries for five minutes
# so zooming/reselecting the same 3 km target does not hit Open-Meteo again.
_three_km_cache: Dict[str, Dict[str, Any]] = {}
_three_km_cache_ttl_seconds = 5 * 60
_three_km_cache_max_items = 256
_three_km_ingestor = None

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "scope": "Pan-India Multi-Modal Atmospheric Intelligence",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/regions")
async def get_regions():
    return {"regions": PAN_INDIA_REGIONS}

@router.get("/landmarks")
async def get_landmarks(region: Optional[str] = Query(default=None)):
    if region and region != "ALL_INDIA":
        filtered = [lm for lm in LANDMARKS if lm.get("region") == region]
        return {"landmarks": filtered, "region": region}
    return {"landmarks": LANDMARKS, "region": "ALL_INDIA"}

@router.get("/regions/{region_id}/landmarks")
async def get_region_landmarks(region_id: str = Path(...)):
    if region_id != "ALL_INDIA":
        filtered = [lm for lm in LANDMARKS if lm.get("region") == region_id]
        return {"landmarks": filtered, "region_id": region_id}
    return {"landmarks": LANDMARKS, "region_id": "ALL_INDIA"}

@router.get("/current-hazards")
async def get_current_hazards():
    return state_container.get("current_state", {})

@router.get("/regions/{region_id}/current-hazards")
async def get_region_hazards(region_id: str = Path(...)):
    reg_states = state_container.get("regions_state", {})
    if region_id in reg_states:
        return reg_states[region_id]
    return state_container.get("current_state", {})

@router.get("/regions/{region_id}/historical-events")
async def get_historical_events(region_id: str = Path(...)):
    return {"events": HISTORICAL_EVENTS}

@router.get("/dashboard/summary")
async def get_dashboard_summary():
    """
    Returns mission control summary metrics aggregated across all Pan-India regions.
    """
    curr = state_container.get("current_state", {})
    cells = curr.get("active_storm_cells", [])
    summary = curr.get("domain_summary", {})

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_active_cells": len(cells),
        "national_max_dbz": summary.get("max_reflectivity_dbz", 0.0),
        "national_max_rain_rate": summary.get("max_rain_rate_mm_hr", 0.0),
        "total_lightning_strokes": summary.get("total_lightning_strokes", 0),
        "cloudburst_threat_cells": summary.get("cloudburst_cells", 0),
        "regions_monitored": len(PAN_INDIA_REGIONS),
        "sensor_health": {
            "dwr_network": "DEGRADED" if state_container.get("radar_offline_mode") else "OPERATIONAL",
            "insat_imager": "OPERATIONAL",
            "damini_lightning": "OPERATIONAL",
            "aws_stations": "OPERATIONAL"
        }
    }

@router.post("/reset")
async def reset_simulation(target_t: int = Query(default=0, ge=0)):
    state_container["sim_t"] = target_t
    return {
        "status": "simulation_reset",
        "new_sim_t": target_t,
        "message": f"Simulation timestep reset to T+{target_t}"
    }

@router.post("/regions/{region_id}/reset")
async def reset_region_simulation(region_id: str = Path(...), target_t: int = Query(default=0, ge=0)):
    state_container["sim_t"] = target_t
    return {
        "status": "simulation_reset",
        "region_id": region_id,
        "new_sim_t": target_t
    }

@router.post("/failover")
async def toggle_failover(radar_offline: Optional[bool] = None):
    if radar_offline is None:
        state_container["radar_offline_mode"] = not state_container.get("radar_offline_mode", False)
    else:
        state_container["radar_offline_mode"] = radar_offline
    return {
        "radar_offline_mode": state_container["radar_offline_mode"],
        "mode": "SATELLITE_FALLBACK (2-3 km)" if state_container["radar_offline_mode"] else "RADAR_FUSED (1 km)"
    }

@router.post("/regions/{region_id}/failover")
async def toggle_region_failover(region_id: str = Path(...), radar_offline: Optional[bool] = None):
    return await toggle_failover(radar_offline)

@router.post("/ai-advisory")
async def get_ai_advisory():
    curr_state = state_container.get("current_state", {})
    advisory = await generate_meteorological_advisory(
        hazard_state=curr_state,
        openrouter_key=settings.OPENROUTER_API_KEY,
        nvidia_key=settings.NVIDIA_API_KEY
    )
    return advisory

@router.get("/alerts/cap")
async def get_cap_xml_alert():
    """
    Exports OASIS / NDMA Common Alerting Protocol (CAP-CP v1.2) XML for government sirens & cell-broadcast across India.
    """
    curr = state_container.get("current_state", {})
    max_dbz = curr.get("domain_summary", {}).get("max_reflectivity_dbz", 45.0)

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    alert_id = f"IN-NDMA-ANTIGRAVITY-{int(datetime.now().timestamp())}"

    root = ET.Element("alert", xmlns="urn:oasis:names:tc:emergency:cap:1.2")
    ET.SubElement(root, "identifier").text = alert_id
    ET.SubElement(root, "sender").text = "nowcast-center@imd.gov.in"
    ET.SubElement(root, "sent").text = now_str
    ET.SubElement(root, "status").text = "Actual"
    ET.SubElement(root, "msgType").text = "Alert"
    ET.SubElement(root, "scope").text = "Public"

    info = ET.SubElement(root, "info")
    ET.SubElement(info, "category").text = "Met"
    ET.SubElement(info, "event").text = "Severe Thunderstorm / Convective Initiation"
    ET.SubElement(info, "urgency").text = "Immediate"
    ET.SubElement(info, "severity").text = "Severe" if max_dbz >= 50 else "Moderate"
    ET.SubElement(info, "certainty").text = "Observed"
    ET.SubElement(info, "headline").text = f"ANTIGRAVITY NATIONAL NOWCAST: Severe Convective Weather Activity Active"
    ET.SubElement(info, "description").text = (
        f"Doppler Weather Radar and INSAT-3D multispectral fusion indicates rapid convective intensification "
        f"(Reflectivity {max_dbz:.1f} dBZ). Strong downburst gusts and localized heavy downpours imminent."
    )
    ET.SubElement(info, "instruction").text = "Take shelter in a sturdy building. Avoid open fields, metal fences, and waterlogged streets."

    area = ET.SubElement(info, "area")
    ET.SubElement(area, "areaDesc").text = "Pan-India Monitored Convective Sectors"
    ET.SubElement(area, "circle").text = "21.5937,78.9629,500.0"

    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return Response(content=xml_bytes, media_type="application/xml")


# ── Weather API Ingestion & 6-Hour Anomaly Endpoints ────────────────────────
@router.get("/anomalies/6h")
async def get_latest_6h_anomalies():
    """
    Returns the latest real-time 6-hour weather anomaly predictions across Indian territory.
    """
    import json
    from pathlib import Path

    processed_file = Path(__file__).resolve().parent.parent / "data" / "processed" / "latest_6h_anomalies.json"
    if processed_file.exists():
        try:
            with open(processed_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as err:
            return {"error": f"Failed reading anomaly cache: {str(err)}", "anomalies": []}

    # If no cache exists, run an ingestion cycle
    try:
        from pipelines.ingestion.weather_api_ingest import run_ingestion, STRATEGIC_INDIAN_STATIONS, DEFAULT_RAW_DIR, DEFAULT_PROCESSED_DIR
        summary = run_ingestion(STRATEGIC_INDIAN_STATIONS[:10], DEFAULT_RAW_DIR, DEFAULT_PROCESSED_DIR, verbose=False)
        return summary
    except Exception as err:
        return {"status": "pending", "message": "No ingestion report generated yet", "error": str(err), "anomalies": []}


@router.post("/ingest/trigger")
async def trigger_weather_ingestion(cities: Optional[str] = Query(None, description="Comma-separated city IDs or names")):
    """
    Triggers live ingestion using Python requests to fetch real-time weather data
    from Open-Meteo and save raw and processed 6-hour anomaly responses.
    """
    from pathlib import Path
    try:
        from pipelines.ingestion.weather_api_ingest import (
            run_ingestion,
            STRATEGIC_INDIAN_STATIONS,
            DEFAULT_RAW_DIR,
            DEFAULT_PROCESSED_DIR
        )
    except ImportError:
        from backend.pipelines.ingestion.weather_api_ingest import (
            run_ingestion,
            STRATEGIC_INDIAN_STATIONS,
            DEFAULT_RAW_DIR,
            DEFAULT_PROCESSED_DIR
        )

    stations_to_run = STRATEGIC_INDIAN_STATIONS
    if cities:
        selected = [c.strip().lower() for c in cities.split(",")]
        stations_to_run = [
            s for s in STRATEGIC_INDIAN_STATIONS
            if s["id"].lower() in selected or s["name"].lower() in selected
        ]

    summary = run_ingestion(stations_to_run, DEFAULT_RAW_DIR, DEFAULT_PROCESSED_DIR, verbose=False)
    return {
        "status": "success",
        "message": f"Ingestion executed for {len(stations_to_run)} stations",
        "summary": summary
    }


@router.get("/ingest/raw/{station_id}")
async def get_raw_weather_payload(station_id: str = Path(..., description="Station ID e.g. delhi, mumbai, kolkata")):
    """
    Returns the raw cached JSON response saved directly from the weather API.
    """
    import json
    from pathlib import Path
    raw_file = Path(__file__).resolve().parent.parent / "data" / "raw" / f"{station_id.lower()}_latest.json"
    if raw_file.exists():
        with open(raw_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"error": f"Raw payload for station '{station_id}' not found", "available_hint": "Trigger /api/ingest/trigger first"}


@router.get("/weather/3km-nowcast")
async def get_3km_nowcast(
    lat: float = Query(..., ge=6.0, le=37.5, description="Latitude of target coordinate in India map domain"),
    lon: float = Query(..., ge=68.0, le=97.5, description="Longitude of target coordinate in India map domain"),
    name: Optional[str] = Query("Selected Target", description="Location name or label")
):
    """
    High-precision 3km radius localized nowcasting and convective anomaly prediction.
    Fetches real-time observations and 6h hourly predictive telemetry, then computes
    3km mesoscale convective core deluge volume, downburst shear velocity, and flash flood risk.
    """
    global _three_km_ingestor

    target_lat = round(float(lat), 4)
    target_lon = round(float(lon), 4)
    cache_key = f"{target_lat:.3f}:{target_lon:.3f}"
    now_epoch = time.time()
    cached = _three_km_cache.get(cache_key)
    if cached and now_epoch - cached["cached_at"] < _three_km_cache_ttl_seconds:
        response = dict(cached["response"])
        response["cache_hit"] = True
        return response

    try:
        from pipelines.ingestion.weather_api_ingest import (
            WeatherDataIngestor,
            compute_3km_radius_metrics,
            analyze_6h_anomalies
        )
    except ImportError:
        from backend.pipelines.ingestion.weather_api_ingest import (
            WeatherDataIngestor,
            compute_3km_radius_metrics,
            analyze_6h_anomalies
        )

    if _three_km_ingestor is None:
        _three_km_ingestor = WeatherDataIngestor(timeout=7)
    payload = await run_in_threadpool(
        _three_km_ingestor.fetch_open_meteo,
        target_lat,
        target_lon,
    )

    if not payload:
        return {
            "error": "Failed to retrieve real-time weather telemetry from Open-Meteo",
            "lat": target_lat,
            "lon": target_lon,
            "name": name
        }

    current = payload.get("current", {})
    hourly = payload.get("hourly", {})

    temp_c = current.get("temperature_2m", 27.0)
    dew_c = current.get("dew_point_2m", temp_c - 4.0)
    rain_mm_hr = current.get("precipitation", 0.0)
    gust_kmh = current.get("wind_gusts_10m", 20.0)
    press_msl = current.get("pressure_msl", 1012.0)
    press_station = current.get("surface_pressure", press_msl - 6.0)
    cloud_cover = current.get("cloud_cover", 40)
    weather_code = current.get("weather_code", 0)

    capes = hourly.get("cape", [])
    max_cape = max(capes) if capes else 0.0

    three_km_metrics = compute_3km_radius_metrics(
        rain_mm_hr=rain_mm_hr,
        cape_j_kg=max_cape,
        gust_kmh=gust_kmh,
        temp_c=temp_c,
        dew_c=dew_c
    )

    station_dict = {
        "id": f"pt-{target_lat:.3f}-{target_lon:.3f}",
        "name": name,
        "state": "Target Sector",
        "zone": "Pan-India",
        "lat": target_lat,
        "lon": target_lon
    }
    anomaly = analyze_6h_anomalies(station_dict, payload)

    # Keep normal-weather targets useful too: always expose six forecast rows,
    # not only rows when the anomaly detector fires.
    times = hourly.get("time", [])
    def forecast_rows() -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        for i in range(min(6, len(times))):
            temps = hourly.get("temperature_2m", [])
            dews = hourly.get("dew_point_2m", [])
            rains = hourly.get("precipitation", [])
            capes_hourly = hourly.get("cape", [])
            gusts = hourly.get("wind_gusts_10m", [])
            temp_h = float(temps[i] if i < len(temps) else temp_c)
            dew_h = float(dews[i] if i < len(dews) else temp_h - 4)
            rain_h = float(rains[i] if i < len(rains) else 0)
            cape_h = float(capes_hourly[i] if i < len(capes_hourly) else 0)
            gust_h = float(gusts[i] if i < len(gusts) else 0)
            severity = "EXTREME" if rain_h >= 50 or (rain_h >= 35 and cape_h >= 1800) else "SEVERE" if rain_h >= 25 or cape_h >= 2000 or gust_h >= 75 else "WARNING" if rain_h >= 10 or cape_h >= 1200 or gust_h >= 50 else "NORMAL"
            metrics_h = compute_3km_radius_metrics(rain_h, cape_h, gust_h, temp_h, dew_h)
            rows.append({
                "hour_offset": i + 1,
                "time": times[i],
                "precipitation_mm": rain_h,
                "precipitation_probability_pct": float((hourly.get("precipitation_probability", []) or [])[i] if i < len(hourly.get("precipitation_probability", [])) else 0),
                "cape_j_kg": cape_h,
                "temperature_c": temp_h,
                "dew_point_c": dew_h,
                "dew_point_depression_c": max(0.0, round(temp_h - dew_h, 1)),
                "wind_gusts_kmh": gust_h,
                "wind_speed_kmh": float((hourly.get("wind_speed_10m", []) or [])[i] if i < len(hourly.get("wind_speed_10m", [])) else 0),
                "weather_code": int((hourly.get("weather_code", []) or [])[i] if i < len(hourly.get("weather_code", [])) else weather_code),
                "weather_description": "Severe weather risk" if severity != "NORMAL" else "Forecast conditions",
                "visibility_km": float((hourly.get("visibility", []) or [])[i] / 1000 if i < len(hourly.get("visibility", [])) else 10),
                "cloud_cover_pct": float((hourly.get("cloud_cover", []) or [])[i] if i < len(hourly.get("cloud_cover", [])) else cloud_cover),
                "pressure_msl_hpa": float((hourly.get("pressure_msl", []) or [])[i] if i < len(hourly.get("pressure_msl", [])) else press_msl),
                "anomaly_detected": severity != "NORMAL",
                "anomaly_severity": severity,
                "three_km_deluge_volume_m3_hr": metrics_h["estimated_deluge_volume_m3_hr"],
                "three_km_flash_flood_risk": metrics_h["flash_runoff_risk"],
            })
        return rows

    response = {
        "location": {
            "name": name,
            "lat": target_lat,
            "lon": target_lon
        },
        "telemetry": {
            "temperature_c": temp_c,
            "apparent_temperature_c": current.get("apparent_temperature", temp_c),
            "dew_point_c": dew_c,
            "dew_point_depression_c": round(max(0.0, temp_c - dew_c), 1),
            "relative_humidity_pct": current.get("relative_humidity_2m", 65),
            "precipitation_mm_hr": rain_mm_hr,
            "pressure_msl_hpa": press_msl,
            "surface_pressure_hpa": press_station,
            "cloud_cover_pct": cloud_cover,
            "weather_code": weather_code,
            "wind_speed_kmh": current.get("wind_speed_10m", 12.0),
            "wind_direction_deg": current.get("wind_direction_10m", 180),
            "wind_gusts_kmh": gust_kmh,
            "visibility_km": 10.0,
            "max_cape_j_kg": max_cape,
        },
        "three_km_radius_analysis": three_km_metrics,
        "six_hour_anomaly": anomaly,
        "hourly_forecast": forecast_rows(),
        "grid": {"radius_km": 3.0, "area_km2": 28.27, "cache_ttl_seconds": _three_km_cache_ttl_seconds},
        "cache_hit": False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    if len(_three_km_cache) >= _three_km_cache_max_items:
        oldest_key = min(_three_km_cache, key=lambda key: _three_km_cache[key]["cached_at"])
        _three_km_cache.pop(oldest_key, None)
    _three_km_cache[cache_key] = {"cached_at": now_epoch, "response": response}
    return response
