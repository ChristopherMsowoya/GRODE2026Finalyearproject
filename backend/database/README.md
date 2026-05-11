# ESRI Phase I Database

This folder contains the database foundation for the ESRI Phase I climate
intelligence engine.

## Step 1: Apply The Foundation Schema

Run the SQL in:

```text
backend/database/migrations/001_phase_i_foundation.sql
```

Use either:

- Supabase SQL Editor
- `psql`
- any PostgreSQL client connected to a PostGIS-enabled database

The migration creates the core Phase I tables for:

- Malawi boundaries
- 5 km grid cells
- daily rainfall time series
- onset results
- false-onset events and probabilities
- dry-spell events and probabilities
- climatology products
- dataset, algorithm, and pipeline run metadata

If `DATABASE_URL` is set in `.env` or `backend/.env`, migrations can also be
applied from the project root with:

```powershell
python -m backend.database.apply_migrations
```

## Design Notes

- Computation stays grid-first.
- Admin boundaries are stored for search and aggregation, not as the primary
  computation unit.
- `daily_rainfall` is partitioned by `rainfall_date` so historical daily data
  can scale to decades of national coverage.
- Algorithm versions and pipeline runs are first-class records to support
  reproducibility.

## Step 2: Import Boundaries

After applying the schema and setting `DATABASE_URL`, load the bundled Malawi
shapefiles:

```powershell
python -m backend.database.import_boundaries
```

## Step 3: Build The 5 km Grid

Generate the national 5 km grid from the imported Malawi boundary:

```powershell
python -m backend.database.build_grid
```

The grid is generated in PostGIS using EPSG:32736 for meter-based 5 km cells,
then stored as WGS84 polygons for web mapping.
