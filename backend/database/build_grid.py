from __future__ import annotations

from backend.database.supabase_client import get_supabase_client


def rebuild_grid() -> int:
    client = get_supabase_client()
    response = client.rpc("rebuild_malawi_grid_5km_v3").execute()
    return response.data


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
    inserted_count = rebuild_grid()
    assignment_summary = assign_grid_cells()
    grid_summary = fetch_grid_summary()

    print(f"Inserted grid cells: {inserted_count}")
    print(f"Assignment summary: {assignment_summary}")
    print(f"Grid summary: {grid_summary}")


if __name__ == "__main__":
    main()
