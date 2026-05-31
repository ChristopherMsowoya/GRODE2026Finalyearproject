# GRODE

**GRODE** means **Grid-Level Rainfall Detection Engine**.

GRODE is a climate intelligence dashboard for Malawi. It uses CHIRPS rainfall data, Malawi boundary data, and grid-level rainfall algorithms to help users understand rainfall onset, false-onset risk, and dry-spell risk across the country.

## What The Project Does

The system analyses rainfall at grid-cell level, then shows the results through a web dashboard.

Main outputs:

- Rainfall onset probability
- False-onset probability
- Dry-spell probability
- Seasonal onset timelines
- District and enumeration-area location selection
- Malawi map layers and grid diagnostics

The important idea is that diagnostics remain tied to the rainfall grid cell where the signal was measured. Districts and enumeration areas are used to help users select places, but the scientific output is grid based.

## Project Structure

```text
backend/
  api/                 FastAPI backend endpoints
  algorithms/          CHIRPS rainfall algorithms and generated outputs
  database/            PostGIS schema, shapefiles, import scripts
  data/                Extra GIS input folders

frontend/
  app/                 Next.js app routes and dashboard pages
  components/          Shared UI components
  lib/                 API client and shared frontend helpers
  public/              Images and static assets
```

## Main Technologies

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Leaflet
- **Backend:** FastAPI, Python
- **Spatial Data:** GeoJSON, Shapefiles, PostGIS-ready scripts
- **Rainfall Data:** CHIRPS daily NetCDF files
- **Database Option:** Supabase/PostgreSQL/PostGIS

## Data Used

### Rainfall Data

CHIRPS rainfall files are stored in:

```text
backend/algorithms/data/raw/
```

Expected file examples:

```text
chirps-v2.0.2022.days_p05.nc
chirps-v2.0.2023.days_p05.nc
chirps-v2.0.2024.days_p05.nc
chirps-v2.0.2025.days_p05.nc
```

### Generated Algorithm Outputs

The frontend can run from generated local outputs:

```text
backend/algorithms/outputs/results.json
backend/algorithms/outputs/results.csv
```

These outputs contain grid-level onset, false-onset, and dry-spell diagnostics.

### GIS/Shapefile Data

Boundary and location data is stored in:

```text
backend/database/data/shapefiles/
```

Important folders:

```text
ADM0(country)       Malawi country boundary
ADM1(region)        Region boundaries
ADM2(district)      District boundaries
ADM3(TA)            Traditional Authority boundaries
enum                Enumeration Area polygons
Location            Populated place points
```

## Algorithms

The rainfall algorithms are in:

```text
backend/algorithms/src/algorithms/
```

### Onset Detection

Rainfall onset is detected when:

- 3-day rainfall total is at least 25 mm
- the next 20 days do not contain a dry spell of 10 or more consecutive dry days

### False Onset

False onset is counted when:

- onset was detected
- the following 20 days contain a dry spell of 10 or more consecutive dry days

### Dry Spell

Dry-spell risk is counted when:

- onset was detected
- the following 20 days contain a dry spell of 5 or more consecutive dry days

## Running The Project Locally

Open two terminals from the project root:

```powershell
cd D:\Projects\GRODE2026Finalyearproject
```

### 1. Start Backend

```powershell
python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8010
```

Useful backend test URLs:

```text
http://127.0.0.1:8010/api/health
http://127.0.0.1:8010/api/dashboard/overview
http://127.0.0.1:8010/api/grid/diagnostic-cells
http://127.0.0.1:8010/api/results/district-summary
```

### 2. Start Frontend

```powershell
cd frontend
npm run dev
```

Open the URL printed by Next.js, usually:

```text
http://localhost:3000
```

## Environment Setup

The frontend should point to the backend:

```text
frontend/.env.local
```

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010
```

For local file-based demo data, the backend should use:

```text
backend/.env
```

```env
GRID_API_SOURCE=local
```

Database credentials can also be placed in `backend/.env` if using Supabase/PostGIS, but the project can run from local `results.json` for demo purposes.

## Enumeration Areas

Enumeration areas allow users to narrow from district level to smaller local areas.

The local EA shapefile is expected at:

```text
backend/database/data/shapefiles/enum/ECHO2_prioritization.shp
```

When running in local mode, the backend reads this shapefile and maps each enumeration area to a nearby rainfall diagnostic grid cell.

Relevant endpoints:

```text
GET /api/locations/districts
GET /api/locations/enumeration-areas?district=Lilongwe
```

## Important Dashboard Pages

```text
/                      Dashboard overview
/onset                 Rainfall onset detection
/false-onset           False-onset risk
/dry-spell             Dry-spell risk
/map                   Grid map
/planting-guide        Planting guidance
```

## Minimum Data Needed For Demo

For a working presentation demo, these are the most important files:

```text
backend/algorithms/outputs/results.json
backend/database/data/shapefiles/ADM2(district)/
backend/database/data/shapefiles/enum/
```

Raw CHIRPS files are needed only if you want to rerun the algorithm.

## Notes For New Contributors

- The system is grid based first, not district based first.
- Districts and enumeration areas help users choose a location.
- Algorithm outputs are stored per grid cell.
- The frontend gets data through the FastAPI backend.
- If Supabase is unavailable, local `results.json` can still power the demo.

## Command to run backend
python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8010

