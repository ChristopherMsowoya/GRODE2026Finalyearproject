from __future__ import annotations

import json
from pathlib import Path

from backend.database.supabase_client import get_supabase_client


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DISTRICTS_GEOJSON_PATH = (
    PROJECT_ROOT
    / "backend"
    / "database"
    / "data"
    / "shapefiles"
    / "ADM2(district)"
    / "geoBoundaries-MWI-ADM2.geojson"
)
TA_GEOJSON_PATH = (
    PROJECT_ROOT
    / "backend"
    / "database"
    / "data"
    / "shapefiles"
    / "ADM3(TA)"
    / "geoBoundaries-MWI-ADM3.geojson"
)


def load_features(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as geojson_file:
        data = json.load(geojson_file)
    return data["features"]


def import_districts() -> int:
    client = get_supabase_client()
    count = 0

    for feature in load_features(DISTRICTS_GEOJSON_PATH):
        properties = feature["properties"]
        payload = {
            "p_shape_id": properties["shapeID"],
            "p_name": properties["shapeName"],
            "p_geom": feature["geometry"],
            "p_metadata": properties,
        }
        client.rpc("upsert_district_boundary", payload).execute()
        count += 1

    return count


def import_traditional_authorities() -> int:
    client = get_supabase_client()
    count = 0

    for feature in load_features(TA_GEOJSON_PATH):
        properties = feature["properties"]
        payload = {
            "p_shape_id": properties["shapeID"],
            "p_name": properties["shapeName"],
            "p_geom": feature["geometry"],
            "p_metadata": properties,
        }
        client.rpc("upsert_traditional_authority_boundary", payload).execute()
        count += 1

    return count


def link_tas_to_districts() -> int:
    client = get_supabase_client()
    response = client.rpc("link_traditional_authorities_to_districts").execute()
    return response.data


def main():
    district_count = import_districts()
    ta_count = import_traditional_authorities()
    linked_ta_count = link_tas_to_districts()

    print(f"Imported districts: {district_count}")
    print(f"Imported traditional authorities: {ta_count}")
    print(f"Linked TAs to districts: {linked_ta_count}")


if __name__ == "__main__":
    main()
