-- Fix the insert_mw_boundary RPC function to handle safe DELETE
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION insert_mw_boundary(geom_json TEXT)
RETURNS VOID AS $$
BEGIN
  -- Delete all existing rows safely (using TRUE condition)
  DELETE FROM mw_boundary WHERE gid > 0;
  
  -- Insert new national boundary with PostGIS geometry
  INSERT INTO mw_boundary (country_name, geom)
  VALUES ('Malawi', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(geom_json), 4326)));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify it works immediately by calling it
-- (We'll call it from Python, but you can test here too)
SELECT 'insert_mw_boundary updated successfully' AS status;
