CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS storm_cells (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id VARCHAR(32),
    observed_at TIMESTAMPTZ,
    centroid GEOMETRY(Point, 4326),
    area_km2 FLOAT,
    max_dbz FLOAT,
    severity VARCHAR(16),
    hail_mesh_mm FLOAT,
    hail_posh_pct FLOAT,
    rain_rate_mm_hr FLOAT,
    downburst_gust_kmh FLOAT,
    speed_kmh FLOAT,
    heading_deg FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS landmark_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128),
    location GEOMETRY(Point, 4326),
    category VARCHAR(64),
    alert_radius_km FLOAT DEFAULT 20.0
);

INSERT INTO landmark_targets (name, location, category, alert_radius_km) VALUES
  ('Mumbai Airport (CSMIA)', ST_SetSRID(ST_MakePoint(72.8656,19.0896),4326), 'Airport', 10),
  ('Mumbai Central Station', ST_SetSRID(ST_MakePoint(72.8247,18.9692),4326), 'Railway', 8),
  ('Mantralaya', ST_SetSRID(ST_MakePoint(72.8333,18.9322),4326), 'Government', 5),
  ('Gateway of India', ST_SetSRID(ST_MakePoint(72.8347,18.9220),4326), 'Landmark', 5),
  ('BKC Commercial Hub', ST_SetSRID(ST_MakePoint(72.8650,19.0660),4326), 'Commercial', 6),
  ('Thane City', ST_SetSRID(ST_MakePoint(72.9781,19.2183),4326), 'Urban', 12),
  ('Pune Station', ST_SetSRID(ST_MakePoint(73.8744,18.5289),4326), 'Railway', 10)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cells_centroid ON storm_cells USING GIST(centroid);
CREATE INDEX IF NOT EXISTS idx_lm_location ON landmark_targets USING GIST(location);
