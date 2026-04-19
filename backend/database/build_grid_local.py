from __future__ import annotations

import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Polygon, shape, mapping
from shapely.ops import transform, unary_union

from backend.database.supabase_client import get_supabase_client


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DISTRICTS_GEOJSON_PATH = (
    PROJECT_ROOT
    / "backend"
    / "database"
    / "data"
    / "shapefiles"
    / "ADM2(district)"
    / "geoBoundaries-MWI-ADM2.geojson"
)
CELL_SIZE_METERS = 5000
BATCH_SIZE = 250


def load_malawi_boundary():
    with DISTRICTS_GEOJSON_PATH.open("r", encoding="utf-8") as geojson_file:
        features = json.load(geojson_file)["features"]

    district_geometries = [shape(feature["geometry"]) for feature in features]
    return unary_union(district_geometries)


def build_grid_rows() -> list[dict]:
    boundary_wgs84 = load_malawi_boundary()
    to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32736", always_xy=True).transform
    to_wgs84 = Transformer.from_crs("EPSG:32736", "EPSG:4326", always_xy=True).transform

    boundary_utm = transform(to_utm, boundary_wgs84)
    min_x, min_y, max_x, max_y = boundary_utm.bounds

    start_x = int(min_x // CELL_SIZE_METERS) * CELL_SIZE_METERS
    start_y = int(min_y // CELL_SIZE_METERS) * CELL_SIZE_METERS
    end_x = int((max_x + CELL_SIZE_METERS - 1) // CELL_SIZE_METERS) * CELL_SIZE_METERS
    end_y = int((max_y + CELL_SIZE_METERS - 1) // CELL_SIZE_METERS) * CELL_SIZE_METERS

    grid_rows: list[dict] = []
    row_num = 0

    for y in range(start_y, end_y, CELL_SIZE_METERS):
        for x in range(start_x, end_x, CELL_SIZE_METERS):
            cell_utm = Polygon(
                [
                    (x, y),
                    (x + CELL_SIZE_METERS, y),
                    (x + CELL_SIZE_METERS, y + CELL_SIZE_METERS),
                    (x, y + CELL_SIZE_METERS),
                    (x, y),
                ]
            )

            centroid_utm = cell_utm.centroid
            if not boundary_utm.contains(centroid_utm):
                continue

            row_num += 1
            cell_wgs84 = transform(to_wgs84, cell_utm)
            centroid_wgs84 = transform(to_wgs84, centroid_utm)

            grid_rows.append(
                {
                    "grid_id": f"MWI-5KM-{row_num:06d}",
                    "geom": mapping(cell_wgs84),
                    "centroid": mapping(centroid_wgs84),
                    "area_km2": round(cell_utm.area / 1_000_000, 3),
                }
            )

    return grid_rows


def chunk_rows(rows: list[dict], chunk_size: int):
    for index in range(0, len(rows), chunk_size):
        yield rows[index : index + chunk_size]


def upload_grid_rows(rows: list[dict]) -> int:
    client = get_supabase_client()
    client.rpc("clear_grid_cells").execute()

    inserted_total = 0
    for batch in chunk_rows(rows, BATCH_SIZE):
        response = client.rpc("insert_grid_cells_batch", {"p_rows": batch}).execute()
        inserted_total += response.data

    return inserted_total


def assign_grid_cells() -> dict:
    client = get_supabase_client()
    response = client.rpc("assign_grid_cells_to_admin_areas").execute()
    return response.data


def fetch_grid_summary() -> dict:
    client = get_supabase_client()
    total_response = client.table("grid_cells").select("id", count="exact").limit(1).execute()
    unmatched_districts_response = (
        client.table("grid_cells")
        .select("id", count="exact")
        .is_("district_id", "null")
        .limit(1)
        .execute()
    )
    unmatched_tas_response = (
        client.table("grid_cells")
        .select("id", count="exact")
        .is_("ta_id", "null")
        .limit(1)
        .execute()
    )

    return {
        "total_grid_cells": total_response.count,
        "unmatched_districts": unmatched_districts_response.count,
        "unmatched_tas": unmatched_tas_response.count,
    }


def main():
    rows = build_grid_rows()
    inserted_count = upload_grid_rows(rows)
    assignment_summary = assign_grid_cells()
    grid_summary = fetch_grid_summary()

    print(f"Prepared local grid cells: {len(rows)}")
    print(f"Inserted grid cells: {inserted_count}")
    print(f"Assignment summary: {assignment_summary}")
    print(f"Grid summary: {grid_summary}")


if __name__ == "__main__":
    main()
