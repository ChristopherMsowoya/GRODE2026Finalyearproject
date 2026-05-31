"""
ESRI Phase I — Import Malawi boundaries into the database.

Populates:
  - mw_boundary        (national boundary from ADM0 GeoJSON)
  - admin_boundaries   (regions/districts/TAs from ADM1/ADM2/ADM3 GeoJSON)

Run from project root:
    python -m backend.database.import_all_boundaries
"""
import json
import uuid
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / "backend" / ".env")

from backend.database.connection import get_connection  # noqa: E402

SHAPEFILES_ROOT = PROJECT_ROOT / "backend" / "database" / "data" / "shapefiles"

ADM0_GEOJSON = SHAPEFILES_ROOT / "ADM0(country)" / "geoBoundaries-MWI-ADM0.geojson"
ADM1_GEOJSON = SHAPEFILES_ROOT / "ADM1(region)"  / "geoBoundaries-MWI-ADM1.geojson"
ADM2_GEOJSON = SHAPEFILES_ROOT / "ADM2(district)" / "geoBoundaries-MWI-ADM2.geojson"
ADM3_GEOJSON = SHAPEFILES_ROOT / "ADM3(TA)"       / "geoBoundaries-MWI-ADM3.geojson"


def load_geojson(path: Path):
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("features", [])


def geom_to_multipolygon_wkt_or_geojson(geometry: dict) -> str:
    """Return the geometry as a GeoJSON string for st_geomfromgeojson."""
    return json.dumps(geometry)


def import_national_boundary(cur):
    print("Importing mw_boundary...")
    features = load_geojson(ADM0_GEOJSON)
    if not features:
        print("  WARNING: No features found in ADM0 GeoJSON.")
        return

    # Delete existing rows
    cur.execute("DELETE FROM mw_boundary;")

    inserted = 0
    for feat in features:
        geom_json = json.dumps(feat["geometry"])
        cur.execute(
            """
            INSERT INTO mw_boundary (country_name, geom)
            VALUES ('Malawi', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
            """,
            (geom_json,)
        )
        inserted += 1

    print(f"  ✅ Inserted {inserted} mw_boundary row(s).")


def import_admin_boundaries(cur, geojson_path: Path, admin_level: int, level_name: str):
    print(f"Importing admin_boundaries level {admin_level} ({level_name})...")

    if not geojson_path.exists():
        print(f"  WARNING: File not found: {geojson_path} — skipping.")
        return

    features = load_geojson(geojson_path)
    if not features:
        print(f"  WARNING: No features in {geojson_path.name}")
        return

    # Delete existing rows for this level
    cur.execute("DELETE FROM admin_boundaries WHERE admin_level = %s;", (admin_level,))

    inserted = 0
    skipped = 0
    for feat in features:
        props = feat.get("properties", {})
        shape_name = props.get("shapeName") or props.get("NAME_2") or props.get("NAME_3") or f"Unknown-{admin_level}"
        shape_id   = props.get("shapeID")   or props.get("GID_2") or props.get("GID_3")

        if not feat.get("geometry"):
            skipped += 1
            continue

        geom_json = json.dumps(feat["geometry"])
        boundary_id = f"MWI-ADM{admin_level}-{shape_id or uuid.uuid4().hex[:8]}"

        cur.execute(
            """
            INSERT INTO admin_boundaries (
                admin_boundary_id, admin_level, shape_name, shape_id, geom
            )
            VALUES (
                %s, %s, %s, %s,
                ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
            )
            ON CONFLICT (admin_boundary_id) DO UPDATE
                SET shape_name = EXCLUDED.shape_name,
                    geom = EXCLUDED.geom;
            """,
            (boundary_id, admin_level, shape_name, shape_id, geom_json)
        )
        inserted += 1

    print(f"  ✅ Inserted/updated {inserted} rows (skipped {skipped} missing geometries).")


def main():
    print("=" * 60)
    print("ESRI Phase I — Boundary Import")
    print("=" * 60)

    with get_connection() as conn:
        with conn.cursor() as cur:
            # National boundary
            import_national_boundary(cur)

            # Admin levels — check which files exist
            levels = [
                (ADM1_GEOJSON, 1, "regions"),
                (ADM2_GEOJSON, 2, "districts"),
                (ADM3_GEOJSON, 3, "traditional-authorities"),
            ]
            for path, level, name in levels:
                import_admin_boundaries(cur, path, level, name)

        conn.commit()

    print("=" * 60)
    print("✅ All boundary imports complete.")
    print("Next step: run  python -m backend.database.build_grid")
    print("=" * 60)


if __name__ == "__main__":
    main()
