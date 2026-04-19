# Supabase Setup

This folder contains the first database foundation for moving the project from file-based outputs to Supabase Postgres with PostGIS.

## What is included

- `sql/001_init_supabase_schema.sql`
  Creates the main spatial tables and indexes.
- `config.py`
  Reads Supabase connection settings from environment variables.
- `supabase_client.py`
  Creates a reusable Supabase Python client.

## Environment variables

Create a root `.env` file from `.env.example` and fill in:

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_DB_SCHEMA`

Use the service role key for backend/server-side scripts only. Do not expose it in the frontend.

## Initial dashboard setup

1. Create a Supabase project.
2. Open `Database` -> `Extensions`.
3. Enable `postgis`.
4. Open `SQL Editor`.
5. Run `backend/database/sql/001_init_supabase_schema.sql`.
6. Run `backend/database/sql/002_boundary_import_functions.sql`.
7. Run `backend/database/sql/003_grid_generation_functions.sql`.

## Install Python dependency

Add the Supabase Python client to the backend environment:

```powershell
python -m pip install supabase
```

Or add it to `backend/algorithms/requirements.txt` and install from there.

## Next recommended implementation steps

1. Run the boundary importer:

```powershell
python -m backend.database.import_boundaries
```

2. Build the 5km Malawi grid:

```powershell
python -m backend.database.build_grid_local
```

3. Load daily CHIRPS rainfall onto the grid:

```powershell
python -m backend.database.ingest_chirps_to_grid 2022
```

4. Load populated places into the `locations` table:

```powershell
python -m backend.database.import_locations
```

5. Add a script that writes algorithm outputs into `grid_risk_results`.
