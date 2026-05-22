# GRODE Enumeration Area Migration Guide

This guide switches GRODE from TA-style selection to a real District -> Enumeration Area hierarchy while keeping all rainfall diagnostics grid based.

## 1. Download EA Geometry

Preferred source: MASDAP GeoServer layer `geonode:eas_bnd`, cited by the HDX/Netherlands Red Cross Malawi EA prioritization dataset.

Run from the repository root:

```powershell
New-Item -ItemType Directory -Force -Path backend\data\gis\enumeration_areas
curl.exe -k -L "https://www.masdap.mw/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=geonode:eas_bnd&outputFormat=json&srsName=EPSG:4326" -o "backend\data\gis\enumeration_areas\malawi_eas_bnd.geojson"
```

If MASDAP returns a 502 response, download the EA layer manually from MASDAP/HDX/Open Africa and place it here:

```text
backend/data/gis/enumeration_areas/
```

Accepted import file:

```text
backend/data/gis/enumeration_areas/malawi_eas_bnd.geojson
```

The import script expects EPSG:4326 GeoJSON. Convert shapefile or GeoPackage inputs before import:

```powershell
ogr2ogr -t_srs EPSG:4326 -f GeoJSON backend\data\gis\enumeration_areas\malawi_eas_bnd.geojson path\to\source_file.shp
```

## 2. Run SQL Migration

Run in PostgreSQL/PostGIS:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS enumeration_areas (
    id TEXT PRIMARY KEY,
    district_name TEXT NOT NULL,
    ta_name TEXT,
    ea_name TEXT NOT NULL,
    source_dataset TEXT,
    geometry geometry(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enumeration_areas_geom
    ON enumeration_areas USING GIST (geometry);

CREATE INDEX IF NOT EXISTS idx_enumeration_areas_district
    ON enumeration_areas (district_name);

CREATE INDEX IF NOT EXISTS idx_enumeration_areas_ta
    ON enumeration_areas (ta_name);

CREATE TABLE IF NOT EXISTS enumeration_area_grid_intersections (
    enumeration_area_id TEXT NOT NULL REFERENCES enumeration_areas(id) ON DELETE CASCADE,
    grid_id TEXT NOT NULL REFERENCES grid_cells(grid_id) ON DELETE CASCADE,
    overlap_area_km2 DOUBLE PRECISION NOT NULL,
    overlap_fraction DOUBLE PRECISION NOT NULL,
    contains_centroid BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (enumeration_area_id, grid_id)
);

CREATE INDEX IF NOT EXISTS idx_eagi_grid_id
    ON enumeration_area_grid_intersections (grid_id);

CREATE INDEX IF NOT EXISTS idx_eagi_area_id
    ON enumeration_area_grid_intersections (enumeration_area_id);
```

Or run the project migration:

```powershell
psql "%DATABASE_URL%" -f backend\database\enumeration_area_grid_mapping.sql
```

## 3. Import EA GeoJSON

Run from the repository root after setting `DATABASE_URL`:

```powershell
python -m backend.database.import_enumeration_areas --input backend\data\gis\enumeration_areas\malawi_eas_bnd.geojson
```

The importer validates GeoJSON, applies `ST_MakeValid`, stores geometries as `MultiPolygon`, and creates spatial indexes.

## 4. Build EA-to-Grid Intersections

Run in PostgreSQL/PostGIS after import:

```sql
TRUNCATE enumeration_area_grid_intersections;

INSERT INTO enumeration_area_grid_intersections (
    enumeration_area_id,
    grid_id,
    overlap_area_km2,
    overlap_fraction,
    contains_centroid
)
SELECT
    ea.id,
    gc.grid_id,
    ST_Area(ST_Intersection(ea.geometry::geography, gc.geom::geography)) / 1000000.0 AS overlap_area_km2,
    ST_Area(ST_Intersection(ea.geometry::geography, gc.geom::geography))
        / NULLIF(ST_Area(ea.geometry::geography), 0) AS overlap_fraction,
    ST_Contains(gc.geom, ST_PointOnSurface(ea.geometry)) AS contains_centroid
FROM enumeration_areas ea
JOIN grid_cells gc
    ON ST_Intersects(ea.geometry, gc.geom)
WHERE NOT ST_IsEmpty(ST_Intersection(ea.geometry, gc.geom));
```

## 5. Restart Backend

```powershell
python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

Verify:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/locations/districts -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:8000/api/locations/enumeration-areas?district=Lilongwe" -UseBasicParsing
```

## 6. Frontend Endpoint Switch

The frontend selector now uses:

```text
GET /api/locations/districts
GET /api/locations/enumeration-areas?district={district}
```

The old TA/grid hierarchy endpoints remain for compatibility, but the user-facing selector no longer uses:

```text
/api/locations/ta
/api/locations/areas
```

## 7. Scientific Rule

Enumeration Areas are only a selection hierarchy. GRODE outputs remain grid based:

```text
EA polygon -> PostGIS grid intersection -> selected grid_id -> grid-level onset/false-onset/dry-spell diagnostics
```
