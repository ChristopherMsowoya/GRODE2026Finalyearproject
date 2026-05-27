# Enumeration Area Geometry

Place the Malawi Enumeration Area GeoJSON here:

```text
backend/data/gis/enumeration_areas/malawi_eas_bnd.geojson
```

The frontend EA selector uses this data after it has been imported into PostGIS and mapped to grid cells.

Expected flow:

```text
District -> Enumeration Area -> primary intersecting grid cell -> grid diagnostics
```

Use `backend/database/EA_MIGRATION_GUIDE.md` for the full import steps.
