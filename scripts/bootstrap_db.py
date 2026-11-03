"""
bootstrap_db.py — Database Bootstrap and Schema Initialization Script.
Complies with Section 5 and Section 23 of SIH 26084 PRD.
"""

import sys
import sqlite3
from pathlib import Path

# Ensure Windows terminal doesn't crash on UTF-8 emojis
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent

DB_PATH = ROOT_DIR / "weather_nowcast.db"


def bootstrap_sqlite():
    print(f"🔧 Bootstrapping local SQLite database at: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Weather sources
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS weather_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        priority INTEGER DEFAULT 1,
        enabled BOOLEAN DEFAULT 1,
        reliability FLOAT DEFAULT 0.9,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Normalized observations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS weather_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        source_timestamp TIMESTAMP NOT NULL,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        temperature_c FLOAT,
        dew_point_c FLOAT,
        relative_humidity FLOAT,
        surface_pressure_hpa FLOAT,
        wind_speed_ms FLOAT,
        wind_direction_deg FLOAT,
        wind_gust_ms FLOAT,
        precipitation_mm FLOAT,
        precipitation_rate_mm_h FLOAT,
        lightning_count INTEGER,
        radar_reflectivity_dbz FLOAT,
        cape_j_kg FLOAT,
        quality_score FLOAT DEFAULT 1.0,
        quality_status TEXT DEFAULT 'PASSED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 0-6h Hazard predictions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS hazard_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grid_id TEXT NOT NULL,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        generated_at TIMESTAMP NOT NULL,
        peak_severity TEXT NOT NULL,
        primary_hazard TEXT NOT NULL,
        peak_risk_score FLOAT NOT NULL,
        lead_time_minutes INTEGER,
        confidence FLOAT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_id TEXT UNIQUE NOT NULL,
        hazard TEXT NOT NULL,
        severity TEXT NOT NULL,
        issued_at TIMESTAMP NOT NULL,
        event_start TIMESTAMP NOT NULL,
        lead_time_minutes INTEGER NOT NULL,
        risk_score FLOAT NOT NULL,
        confidence FLOAT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()
    print("✅ Database schema initialized successfully.")


if __name__ == "__main__":
    bootstrap_sqlite()
