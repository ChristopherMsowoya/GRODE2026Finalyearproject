-- GRODE: Helper RPC functions for boundary import via REST API
-- Run this ONCE in Supabase SQL Editor before running the Python import script.

-- Function to insert national boundary with PostGIS geometry
CREATE OR REPLACE FUNCTION insert_mw_boundary(geom_json TEXT)
RETURNS VOID AS $$
BEGIN
  DELETE FROM mw_boundary;
  INSERT INTO mw_boundary (country_name, geom)
  VALUES ('Malawi', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geom_json), 4326)));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to insert admin boundary with PostGIS geometry
CREATE OR REPLACE FUNCTION insert_admin_boundary(
  p_id       TEXT,
  p_level    INTEGER,
  p_name     TEXT,
  p_shape_id TEXT,
  p_geom_json TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO admin_boundaries (admin_boundary_id, admin_level, shape_name, shape_id, geom)
  VALUES (
    p_id,
    p_level,
    p_name,
    p_shape_id,
    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geom_json), 4326))
  )
  ON CONFLICT (admin_boundary_id) DO UPDATE
    SET shape_name = EXCLUDED.shape_name,
        geom       = EXCLUDED.geom;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify functions were created
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('insert_mw_boundary', 'insert_admin_boundary')
  AND routine_schema = 'public';
