"""
weather_api_ingest.py — Real-Time Weather API Data Ingestion & 6-Hour Anomaly Prediction Script.

Connects to open, free real-time weather APIs using the Python `requests` library to fetch:
  1. Surface meteorological observations (temperature, humidity, wind, pressure, precipitation)
  2. 0-to-6-hour hourly predictive nowcast data (precipitation rates, rain probability, CAPE, gusts)
  3. Severe convective weather anomalies (cloudbursts, severe hail, squalls, thermal extremes)

Saves raw API responses and processed 6-hour anomaly predictions to structured storage
(backend/data/raw/ and backend/data/processed/).
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Ensure Windows terminal doesn't crash on UTF-8 emojis
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


# ── Base Directory Setup ───────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent.parent
REPO_DIR = BACKEND_DIR.parent

DEFAULT_RAW_DIR = BACKEND_DIR / "data" / "raw"
DEFAULT_PROCESSED_DIR = BACKEND_DIR / "data" / "processed"

# ── Strategic Indian Territory Meteorological Stations ─────────────────────
# Covers all 36 States & Union Territories across all macro-zones
STRATEGIC_INDIAN_STATIONS: List[Dict[str, Any]] = [
    # North India
    {"id": "delhi", "name": "New Delhi", "state": "Delhi (NCT)", "zone": "North", "lat": 28.6139, "lon": 77.2090},
    {"id": "srinagar", "name": "Srinagar", "state": "Jammu & Kashmir", "zone": "North", "lat": 34.0837, "lon": 74.7973},
    {"id": "leh", "name": "Leh", "state": "Ladakh", "zone": "North", "lat": 34.1526, "lon": 77.5771},
    {"id": "shimla", "name": "Shimla", "state": "Himachal Pradesh", "zone": "North", "lat": 31.1048, "lon": 77.1734},
    {"id": "dehradun", "name": "Dehradun", "state": "Uttarakhand", "zone": "North", "lat": 30.3165, "lon": 78.0322},
    {"id": "chandigarh", "name": "Chandigarh", "state": "Chandigarh", "zone": "North", "lat": 30.7333, "lon": 76.7794},
    {"id": "amritsar", "name": "Amritsar", "state": "Punjab", "zone": "North", "lat": 31.6340, "lon": 74.8723},
    {"id": "gurgaon", "name": "Gurugram", "state": "Haryana", "zone": "North", "lat": 28.4595, "lon": 77.0266},
    {"id": "lucknow", "name": "Lucknow", "state": "Uttar Pradesh", "zone": "North", "lat": 26.8467, "lon": 80.9462},
    {"id": "jaipur", "name": "Jaipur", "state": "Rajasthan", "zone": "North", "lat": 26.9124, "lon": 75.7873},

    # West India
    {"id": "mumbai", "name": "Mumbai", "state": "Maharashtra", "zone": "West", "lat": 19.0760, "lon": 72.8777},
    {"id": "pune", "name": "Pune", "state": "Maharashtra", "zone": "West", "lat": 18.5204, "lon": 73.8567},
    {"id": "nagpur", "name": "Nagpur", "state": "Maharashtra", "zone": "West", "lat": 21.1458, "lon": 79.0882},
    {"id": "ahmedabad", "name": "Ahmedabad", "state": "Gujarat", "zone": "West", "lat": 23.0225, "lon": 72.5714},
    {"id": "surat", "name": "Surat", "state": "Gujarat", "zone": "West", "lat": 21.1702, "lon": 72.8311},
    {"id": "panaji", "name": "Panaji", "state": "Goa", "zone": "West", "lat": 15.4909, "lon": 73.8278},

    # South India
    {"id": "bengaluru", "name": "Bengaluru", "state": "Karnataka", "zone": "South", "lat": 12.9716, "lon": 77.5946},
    {"id": "chennai", "name": "Chennai", "state": "Tamil Nadu", "zone": "South", "lat": 13.0827, "lon": 80.2707},
    {"id": "hyderabad", "name": "Hyderabad", "state": "Telangana", "zone": "South", "lat": 17.3850, "lon": 78.4867},
    {"id": "kochi", "name": "Kochi", "state": "Kerala", "zone": "South", "lat": 9.9312, "lon": 76.2673},
    {"id": "thiruvananthapuram", "name": "Thiruvananthapuram", "state": "Kerala", "zone": "South", "lat": 8.5241, "lon": 76.9366},
    {"id": "visakhapatnam", "name": "Visakhapatnam", "state": "Andhra Pradesh", "zone": "South", "lat": 17.6868, "lon": 83.2185},
    {"id": "puducherry", "name": "Puducherry", "state": "Puducherry", "zone": "South", "lat": 11.9416, "lon": 79.8083},

    # East & Central India
    {"id": "kolkata", "name": "Kolkata", "state": "West Bengal", "zone": "East", "lat": 22.5726, "lon": 88.3639},
    {"id": "bhubaneswar", "name": "Bhubaneswar", "state": "Odisha", "zone": "East", "lat": 20.2961, "lon": 85.8245},
    {"id": "patna", "name": "Patna", "state": "Bihar", "zone": "East", "lat": 25.5941, "lon": 85.1376},
    {"id": "ranchi", "name": "Ranchi", "state": "Jharkhand", "zone": "East", "lat": 23.3441, "lon": 85.3096},
    {"id": "bhopal", "name": "Bhopal", "state": "Madhya Pradesh", "zone": "Central", "lat": 23.2599, "lon": 77.4126},
    {"id": "raipur", "name": "Raipur", "state": "Chhattisgarh", "zone": "Central", "lat": 21.2514, "lon": 81.6296},

    # Northeast India
    {"id": "guwahati", "name": "Guwahati", "state": "Assam", "zone": "Northeast", "lat": 26.1445, "lon": 91.7362},
    {"id": "shillong", "name": "Shillong", "state": "Meghalaya", "zone": "Northeast", "lat": 25.5788, "lon": 91.8933},
    {"id": "gangtok", "name": "Gangtok", "state": "Sikkim", "zone": "Northeast", "lat": 27.3389, "lon": 88.6065},
    {"id": "agartala", "name": "Agartala", "state": "Tripura", "zone": "Northeast", "lat": 23.8315, "lon": 91.2868},
    {"id": "imphal", "name": "Imphal", "state": "Manipur", "zone": "Northeast", "lat": 24.8170, "lon": 93.9368},
    {"id": "aizawl", "name": "Aizawl", "state": "Mizoram", "zone": "Northeast", "lat": 23.7271, "lon": 92.7176},
    {"id": "kohima", "name": "Kohima", "state": "Nagaland", "zone": "Northeast", "lat": 25.6751, "lon": 94.1086},
    {"id": "itanagar", "name": "Itanagar", "state": "Arunachal Pradesh", "zone": "Northeast", "lat": 27.0844, "lon": 93.6053},

    # Islands
    {"id": "port-blair", "name": "Port Blair", "state": "Andaman & Nicobar Islands", "zone": "Islands", "lat": 11.6234, "lon": 92.7265},
    {"id": "kavaratti", "name": "Kavaratti", "state": "Lakshadweep", "zone": "Islands", "lat": 10.5667, "lon": 72.6417},
]


class WeatherDataIngestor:
    """
    Robust HTTP data ingestion engine for Indian weather telemetry using `requests`.
    """

    def __init__(self, timeout: int = 10, max_retries: int = 3):
        self.timeout = timeout
        self.session = requests.Session()

        # Configure automatic retries with exponential backoff
        retries = Retry(
            total=max_retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            raise_on_status=False
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

        self.session.headers.update({
            "User-Agent": "StormSentinel-WeatherNowcasting/3.0 (AntiGravity SIH Mission; Python requests)",
            "Accept": "application/json",
        })

    def fetch_open_meteo(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """
        Fetches current observations + 6-hour hourly predictions from Open-Meteo.
        Open-Meteo is completely free, CORS enabled, and requires no API key.
        """
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,surface_pressure,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,dew_point_2m",
            "hourly": "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,rain,showers,weather_code,surface_pressure,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape,cloud_cover",
            "forecast_hours": 6,
            "timezone": "Asia/Kolkata",
        }

        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
            else:
                print(f"[WARN] Open-Meteo returned status {resp.status_code} for ({lat}, {lon}): {resp.text[:120]}")
                return None
        except Exception as err:
            print(f"[ERROR] Request failed for Open-Meteo ({lat}, {lon}): {err}")
            return None

    def fetch_wttr_in(self, city_name: str) -> Optional[Dict[str, Any]]:
        """
        Fetches instant weather conditions from wttr.in as secondary/cross-verification source.
        100% free open HTTP JSON API.
        """
        url = f"https://wttr.in/{city_name.replace(' ', '+')}?format=j1"
        try:
            resp = self.session.get(url, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
            return None
        except Exception:
            return None

    def batch_fetch_open_meteo(self, stations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Batch fetches multiple Indian stations in a single vectorized HTTP request.
        """
        if not stations:
            return []

        lats = ",".join([str(round(s["lat"], 4)) for s in stations])
        lons = ",".join([str(round(s["lon"], 4)) for s in stations])

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lats,
            "longitude": lons,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,surface_pressure,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,dew_point_2m",
            "hourly": "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,precipitation,rain,showers,weather_code,surface_pressure,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cape,cloud_cover",
            "forecast_hours": 6,
            "timezone": "Asia/Kolkata",
        }

        try:
            resp = self.session.get(url, params=params, timeout=self.timeout * 2)
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, list) else [data]
            else:
                print(f"[WARN] Batch fetch failed with status {resp.status_code}")
                return []
        except Exception as err:
            print(f"[ERROR] Batch request failed: {err}")
            return []


def compute_3km_radius_metrics(rain_mm_hr: float, cape_j_kg: float, gust_kmh: float, temp_c: float, dew_c: float) -> Dict[str, Any]:
    """
    Computes high-precision 3km radius mesoscale impact indicators:
    - 3km core area (28.27 km2)
    - Deluge precipitation volume (m3/h)
    - Downburst shear velocity (km/h)
    - Flash inundation runoff risk factor
    - Radar core equivalent reflectivity (dBZ)
    """
    import math
    radius_km = 3.0
    core_area_km2 = round(math.pi * (radius_km ** 2), 2)  # ~28.27 km2
    deluge_volume_m3_hr = int(rain_mm_hr * core_area_km2 * 1000)
    downburst_shear_velocity_kmh = round(max(gust_kmh, math.sqrt(max(0.0, cape_j_kg)) * 1.45 + gust_kmh * 0.4), 1)
    dp_depression = round(max(0.0, temp_c - dew_c), 1)

    runoff_risk = "LOW"
    if rain_mm_hr >= 50.0 or (rain_mm_hr >= 30.0 and cape_j_kg >= 1800):
        runoff_risk = "CRITICAL"
    elif rain_mm_hr >= 25.0 or cape_j_kg >= 2000:
        runoff_risk = "HIGH"
    elif rain_mm_hr >= 10.0 or cape_j_kg >= 1000:
        runoff_risk = "MODERATE"

    core_dbz = 15.0
    if rain_mm_hr > 0.1:
        z_linear = 200.0 * (rain_mm_hr ** 1.6)
        core_dbz = round(min(68.0, max(15.0, 10.0 * math.log10(z_linear))), 1)

    return {
        "radius_km": radius_km,
        "core_area_km2": core_area_km2,
        "estimated_deluge_volume_m3_hr": deluge_volume_m3_hr,
        "downburst_shear_velocity_kmh": downburst_shear_velocity_kmh,
        "flash_runoff_risk": runoff_risk,
        "convective_core_dbz": core_dbz,
        "dew_point_depression_c": dp_depression,
    }


def analyze_6h_anomalies(station: Dict[str, Any], raw_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Analyzes hourly forecast to detect severe weather anomalies up to 6 hours ahead,
    with high-precision 3km radius impact indicators.
    """
    hourly = raw_payload.get("hourly", {})
    times = hourly.get("time", [])
    precips = hourly.get("precipitation", [])
    capes = hourly.get("cape", [])
    gusts = hourly.get("wind_gusts_10m", [])
    temps = hourly.get("temperature_2m", [])
    dews = hourly.get("dew_point_2m", [])
    probs = hourly.get("precipitation_probability", [])

    if not precips:
        return None

    max_p = max(precips) if precips else 0.0
    max_cape = max(capes) if capes else 0.0
    max_gust = max(gusts) if gusts else 0.0

    # Determine peak anomaly hour offset (1..6)
    worst_hour_idx = precips.index(max_p) if max_p > 0 else 2
    lead_time_hours = worst_hour_idx + 1
    lead_time_minutes = lead_time_hours * 60

    severity = "NONE"
    anomaly_type = "NORMAL"
    headline = ""
    protocol = ""

    # Severe Convective Anomaly Criteria (IMD / NDMA Standards)
    if max_p >= 50.0 or (max_p >= 35.0 and max_cape >= 1800):
        severity = "EXTREME"
        anomaly_type = "CLOUDBURST_ALERT"
        headline = f"T-6h Advance Prediction: Intense 3km convective cloudburst core in {station['name']} within {lead_time_hours}h ({max_p:.1f} mm/h core)"
        protocol = "Immediate 3km core drainage activation, SDMA/NDRF alert, low-lying evacuation"
    elif max_p >= 25.0 or max_cape >= 2000 or max_gust >= 75:
        severity = "SEVERE"
        anomaly_type = "SEVERE_THUNDERSTORM" if max_cape >= 2000 else "GALE_SQUALL"
        headline = f"T-6h Advance Prediction: Severe thunderstorm with hail risk (CAPE {max_cape:.0f} J/kg) in {station['name']} within {lead_time_hours}h"
        protocol = "Civil defense alert, 3km perimeter underpass monitoring, power transmission safety protocol"
    elif max_p >= 10.0 or max_cape >= 1200 or max_gust >= 50:
        severity = "WARNING"
        anomaly_type = "HEAVY_CONVECTIVE_RAIN"
        headline = f"T-6h Advance Prediction: Convective initiation & heavy downpours in {station['name']} within {lead_time_hours}h"
        protocol = "Municipal stormwater monitoring, agro-met advisory broadcast"

    if severity == "NONE":
        return None

    cur = raw_payload.get("current", {})
    cur_temp = cur.get("temperature_2m", temps[worst_hour_idx] if worst_hour_idx < len(temps) else 28.0)
    cur_dew = cur.get("dew_point_2m", dews[worst_hour_idx] if worst_hour_idx < len(dews) else cur_temp - 4.5)
    three_km_metrics = compute_3km_radius_metrics(max_p, max_cape, max_gust, cur_temp, cur_dew)

    hourly_breakdown = []
    for h in range(min(6, len(times))):
        h_p = precips[h] if h < len(precips) else 0.0
        h_cape = capes[h] if h < len(capes) else 0.0
        h_gust = gusts[h] if h < len(gusts) else 0.0
        h_temp = temps[h] if h < len(temps) else 25.0
        h_dew = dews[h] if h < len(dews) else h_temp - 4.0
        h_3km = compute_3km_radius_metrics(h_p, h_cape, h_gust, h_temp, h_dew)

        hourly_breakdown.append({
            "hour_offset": h + 1,
            "time": times[h],
            "precipitation_mm": h_p,
            "precipitation_prob_pct": probs[h] if h < len(probs) else 0,
            "cape_j_kg": h_cape,
            "wind_gusts_kmh": h_gust,
            "temperature_c": h_temp,
            "dew_point_c": h_dew,
            "three_km_deluge_volume_m3_hr": h_3km["estimated_deluge_volume_m3_hr"],
            "three_km_flash_flood_risk": h_3km["flash_runoff_risk"],
        })

    return {
        "station_id": station["id"],
        "station_name": station["name"],
        "state": station["state"],
        "zone": station["zone"],
        "lat": station["lat"],
        "lon": station["lon"],
        "anomaly_type": anomaly_type,
        "severity": severity,
        "lead_time_hours": lead_time_hours,
        "lead_time_minutes": lead_time_minutes,
        "estimated_occurrence": times[worst_hour_idx] if worst_hour_idx < len(times) else f"T+{lead_time_hours}h",
        "peak_rain_mm_hr": round(max_p, 1),
        "peak_cape_j_kg": round(max_cape, 1),
        "peak_gust_kmh": round(max_gust, 1),
        "warning_headline": headline,
        "action_protocol": protocol,
        "three_km_metrics": three_km_metrics,
        "hourly_breakdown": hourly_breakdown,
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }


def run_ingestion(
    stations: List[Dict[str, Any]],
    raw_dir: Path,
    processed_dir: Path,
    verbose: bool = True
) -> Dict[str, Any]:
    """
    Executes a complete ingestion cycle across selected Indian stations,
    saves the raw API payloads, and computes 6-hour anomaly predictions.
    """
    raw_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)

    ingestor = WeatherDataIngestor()
    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    iso_now = datetime.now(timezone.utc).isoformat()

    if verbose:
        print(f"\n=======================================================")
        print(f"🌪️  StormSentinel Real-Time Weather Data Ingestion")
        print(f"📡 API: Open-Meteo Free Global-WMO API (requests)")
        print(f"📍 Stations: {len(stations)} Indian Meteorological Nodes")
        print(f"⏰ Execution Time: {iso_now}")
        print(f"=======================================================\n")

    # Ingest in chunks of 15 stations to respect URL length and API limits
    CHUNK_SIZE = 15
    raw_results: Dict[str, Any] = {}
    detected_anomalies: List[Dict[str, Any]] = []

    for i in range(0, len(stations), CHUNK_SIZE):
        chunk = stations[i:i + CHUNK_SIZE]
        if verbose:
            names = ", ".join([s["name"] for s in chunk])
            print(f"Fetching chunk {i // CHUNK_SIZE + 1} ({len(chunk)} stations): {names}...")

        batch_data = ingestor.batch_fetch_open_meteo(chunk)

        for s_idx, station in enumerate(chunk):
            payload = batch_data[s_idx] if s_idx < len(batch_data) else None
            if not payload:
                # Fallback to single station request
                payload = ingestor.fetch_open_meteo(station["lat"], station["lon"])

            if payload:
                raw_results[station["id"]] = {
                    "station": station,
                    "payload": payload,
                    "ingested_at": iso_now,
                }

                # Save individual station raw cache
                city_raw_file = raw_dir / f"{station['id']}_latest.json"
                with open(city_raw_file, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2)

                # Analyze 6-Hour Anomaly Predictions
                anomaly = analyze_6h_anomalies(station, payload)
                if anomaly:
                    detected_anomalies.append(anomaly)
                    if verbose:
                        print(f"  🚨 [{anomaly['severity']}] {anomaly['station_name']} ({anomaly['state']}): {anomaly['warning_headline']}")

    # ── Save Full Raw Batch Response ───────────────────────────────────────
    batch_raw_file = raw_dir / f"weather_ingest_batch_{timestamp_str}.json"
    latest_raw_file = raw_dir / "latest_pan_india_raw.json"

    with open(batch_raw_file, "w", encoding="utf-8") as f:
        json.dump(raw_results, f, indent=2)

    with open(latest_raw_file, "w", encoding="utf-8") as f:
        json.dump(raw_results, f, indent=2)

    # ── Save Processed 6-Hour Anomaly Synthesis ───────────────────────────
    anomaly_summary = {
        "ingestion_timestamp": iso_now,
        "stations_monitored": len(stations),
        "stations_successfully_ingested": len(raw_results),
        "anomalies_detected_count": len(detected_anomalies),
        "critical_count": sum(1 for a in detected_anomalies if a["severity"] == "EXTREME"),
        "severe_count": sum(1 for a in detected_anomalies if a["severity"] == "SEVERE"),
        "warning_count": sum(1 for a in detected_anomalies if a["severity"] == "WARNING"),
        "lead_time_horizon": "0 to 6 Hours (T-6h Early Warning)",
        "anomalies": detected_anomalies,
    }

    processed_file = processed_dir / f"anomalies_6h_{timestamp_str}.json"
    latest_processed_file = processed_dir / "latest_6h_anomalies.json"

    with open(processed_file, "w", encoding="utf-8") as f:
        json.dump(anomaly_summary, f, indent=2)

    with open(latest_processed_file, "w", encoding="utf-8") as f:
        json.dump(anomaly_summary, f, indent=2)

    if verbose:
        print(f"\n✅ Ingestion complete.")
        print(f"   • Raw responses saved to: {latest_raw_file}")
        print(f"   • 6-Hour Anomalies saved to: {latest_processed_file}")
        print(f"   • Total Impending Anomalies: {len(detected_anomalies)} (Critical: {anomaly_summary['critical_count']}, Severe: {anomaly_summary['severe_count']}, Warning: {anomaly_summary['warning_count']})\n")

    return anomaly_summary


def main():
    parser = argparse.ArgumentParser(
        description="StormSentinel Weather API Data Ingestion Script (Python requests)"
    )
    parser.add_argument(
        "--all-india",
        action="store_true",
        default=True,
        help="Ingest all strategic stations across 36 Indian States & UTs"
    )
    parser.add_argument(
        "--cities",
        type=str,
        default="",
        help="Comma-separated list of city IDs or names (e.g., 'delhi,mumbai,guwahati')"
    )
    parser.add_argument(
        "--raw-dir",
        type=str,
        default=str(DEFAULT_RAW_DIR),
        help=f"Directory to save raw API responses (default: {DEFAULT_RAW_DIR})"
    )
    parser.add_argument(
        "--processed-dir",
        type=str,
        default=str(DEFAULT_PROCESSED_DIR),
        help=f"Directory to save processed 6h anomaly reports (default: {DEFAULT_PROCESSED_DIR})"
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Run continuously in a loop for continuous scheduled ingestion"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Polling interval in seconds when running with --loop (default: 300s / 5m)"
    )

    args = parser.parse_args()

    raw_path = Path(args.raw_dir)
    processed_path = Path(args.processed_dir)

    # Filter stations if specific cities provided
    stations_to_run = STRATEGIC_INDIAN_STATIONS
    if args.cities:
        selected_names = [c.strip().lower() for c in args.cities.split(",")]
        stations_to_run = [
            s for s in STRATEGIC_INDIAN_STATIONS
            if s["id"].lower() in selected_names or s["name"].lower() in selected_names
        ]
        if not stations_to_run:
            print(f"[ERROR] No stations matched criteria '{args.cities}'. Available stations: {', '.join([s['id'] for s in STRATEGIC_INDIAN_STATIONS])}")
            sys.exit(1)

    if args.loop:
        print(f"🔄 Starting continuous ingestion loop (interval: {args.interval}s)... Press Ctrl+C to stop.")
        while True:
            try:
                run_ingestion(stations_to_run, raw_path, processed_path, verbose=True)
                time.sleep(args.interval)
            except KeyboardInterrupt:
                print("\n🛑 Ingestion loop terminated by user.")
                break
    else:
        run_ingestion(stations_to_run, raw_path, processed_path, verbose=True)


if __name__ == "__main__":
    main()
