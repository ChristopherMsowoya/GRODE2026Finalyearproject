-- Enumeration Area to 5km Grid mapping for GRODE.
-- Load real enumeration-area polygons into enumeration_areas first, then run
-- the INSERT query to create scientifically valid area-to-grid relationships.

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

-- Rebuild intersections after enumeration_areas and grid_cells are loaded.
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
