# 🗄️ Database & Spatial Storage Service (PostgreSQL + PostGIS)

This folder contains the complete spatial database schema and initialization scripts for **StormSentinel**.

---

## 📁 Folder Contents

* **[`init_db.sql`](init_db.sql)**: Complete database schema with PostGIS spatial extensions, `storm_cells` tracking tables, `landmark_targets` infrastructure points, and high-performance GiST spatial indexes.
* **[`docker-compose.yml`](docker-compose.yml)**: Self-contained Docker Compose configuration for launching PostGIS 16 and Redis 7.

---

## 🚀 Deployment Options

### Option 1: Supabase (Recommended Cloud PostGIS — Free Tier)

1. Create a free account at [supabase.com](https://supabase.com) and create a project.
2. In the Supabase Dashboard, go to **Database** -> **Extensions**.
3. Search for `postgis` and click **Enable**.
4. Navigate to the **SQL Editor**, open [`init_db.sql`](init_db.sql), paste its entire contents, and click **Run**.
5. Copy your connection URI from **Project Settings** -> **Database**:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
6. Paste this URI as `DATABASE_URL` in your backend deployment environment.

---

### Option 2: Docker Compose (Local / Self-Hosted VPS)

Run the database and Redis cache locally with a single command:

```bash
docker compose up -d
```

This starts:
* **PostGIS 16**: Port `5432` (User: `weather_admin`, Password: `stormsentinel_secure_2024`, DB: `stormsentinel`)
* **Redis 7**: Port `6379`
* Schema from `init_db.sql` is automatically executed on initial container startup.

---

### Option 3: Neon / AWS RDS / DigitalOcean Managed Postgres

1. Create a PostgreSQL instance on your provider.
2. Ensure the `postgis` and `uuid-ossp` extensions are installed:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
3. Execute the tables and seed data in [`init_db.sql`](init_db.sql).
4. Provide the resulting connection string to the backend as `DATABASE_URL`.
