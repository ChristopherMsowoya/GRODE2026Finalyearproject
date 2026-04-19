from __future__ import annotations

from pathlib import Path

import shapefile

from backend.database.supabase_client import get_supabase_client


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOCATIONS_SHP_PATH = (
    PROJECT_ROOT
    / "backend"
    / "database"
    / "data"
    / "shapefiles"
    / "Location"
    / "hotosm_mwi_populated_places_points_shp.shp"
)
BATCH_SIZE = 250


def choose_name(record: dict) -> str | None:
    for field in ("name", "name_en", "name_ny"):
        value = (record.get(field) or "").strip()
        if value:
            return value
    return None


def chunk_rows(rows: list[dict], chunk_size: int):
    for index in range(0, len(rows), chunk_size):
        yield rows[index : index + chunk_size]


def load_location_rows() -> list[dict]:
    reader = shapefile.Reader(str(LOCATIONS_SHP_PATH))
    field_names = [field[0] for field in reader.fields[1:]]
    rows: list[dict] = []

    for shape_record in reader.iterShapeRecords():
        record = dict(zip(field_names, shape_record.record))
        name = choose_name(record)
        if not name or not shape_record.shape.points:
            continue

        lon, lat = shape_record.shape.points[0]
        rows.append(
            {
                "name": name,
                "geom": {"type": "Point", "coordinates": [lon, lat]},
                "metadata": {
                    "name": record.get("name"),
                    "name_en": record.get("name_en"),
                    "name_ny": record.get("name_ny"),
                    "place": record.get("place"),
                    "population": str(record.get("population") or ""),
                    "source": record.get("source"),
                    "osm_id": str(record.get("osm_id") or ""),
                    "osm_type": record.get("osm_type"),
                },
            }
        )

    return rows


def import_locations(rows: list[dict]) -> int:
    client = get_supabase_client()
    client.rpc("clear_locations").execute()

    inserted_total = 0
    for batch in chunk_rows(rows, BATCH_SIZE):
        response = client.rpc("insert_locations_batch", {"p_rows": batch}).execute()
        inserted_total += response.data

    return inserted_total


def main():
    rows = load_location_rows()
    inserted_total = import_locations(rows)
    print(f"Prepared locations: {len(rows)}")
    print(f"Inserted locations: {inserted_total}")


if __name__ == "__main__":
    main()
