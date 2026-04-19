from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import xarray as xr

from backend.algorithms.src.ingestion.chirps_loader import normalize_chirps_dataset
from backend.database.supabase_client import get_supabase_client


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DATA_DIR = PROJECT_ROOT / "backend" / "algorithms" / "data" / "raw"
BATCH_SIZE = 1000


def parse_args():
    parser = argparse.ArgumentParser(
        description="Sample CHIRPS daily rainfall onto the 5km Malawi grid centroids."
    )
    parser.add_argument(
        "years",
        nargs="*",
        type=int,
        help="Years to ingest. If omitted, all p05 NetCDF files in raw/ are used.",
    )
    return parser.parse_args()


def resolve_files(years: list[int]) -> list[Path]:
    if years:
        files = [RAW_DATA_DIR / f"chirps-v2.0.{year}.days_p05.nc" for year in years]
    else:
        files = sorted(RAW_DATA_DIR.glob("chirps-v2.0.*.days_p05.nc"))

    missing = [str(path) for path in files if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing CHIRPS files: {missing}")

    if not files:
        raise FileNotFoundError(f"No p05 CHIRPS files found in {RAW_DATA_DIR}")

    return files


def get_grid_centroids() -> list[dict]:
    client = get_supabase_client()
    response = client.rpc("get_grid_cell_centroids").execute()
    rows = response.data or []

    if not rows:
        raise RuntimeError("No grid cells found in Supabase. Build and upload the 5km grid first.")

    return rows


def chunk_rows(rows: list[dict], chunk_size: int):
    for index in range(0, len(rows), chunk_size):
        yield rows[index : index + chunk_size]


def upsert_grid_rainfall(rows: list[dict]) -> int:
    client = get_supabase_client()
    total = 0

    for batch in chunk_rows(rows, BATCH_SIZE):
        response = client.rpc("upsert_grid_rainfall_batch", {"p_rows": batch}).execute()
        total += response.data

    return total


def sample_file_to_grid(file_path: Path, centroids: list[dict]) -> int:
    ds = xr.open_dataset(file_path)
    ds = normalize_chirps_dataset(ds)

    lon_points = xr.DataArray(
        np.array([row["longitude"] for row in centroids]),
        dims="points",
    )
    lat_points = xr.DataArray(
        np.array([row["latitude"] for row in centroids]),
        dims="points",
    )

    sampled = ds["precip"].sel(lon=lon_points, lat=lat_points, method="nearest")
    rainfall_values = sampled.transpose("time", "points").values
    time_values = sampled["time"].values

    rows: list[dict] = []
    for time_index, obs_time in enumerate(time_values):
        obs_date = str(np.datetime_as_string(obs_time, unit="D"))

        for point_index, centroid in enumerate(centroids):
            rainfall_mm = float(rainfall_values[time_index, point_index])
            rows.append(
                {
                    "grid_cell_id": centroid["grid_cell_id"],
                    "obs_date": obs_date,
                    "rainfall_mm": round(rainfall_mm, 3),
                    "assignment_method": "centroid_to_chirps_cell",
                }
            )

    ds.close()
    return upsert_grid_rainfall(rows)


def main():
    args = parse_args()
    files = resolve_files(args.years)
    centroids = get_grid_centroids()

    grand_total = 0
    for file_path in files:
        upserted_count = sample_file_to_grid(file_path, centroids)
        grand_total += upserted_count
        print(f"{file_path.name}: upserted {upserted_count} daily grid rainfall rows")

    print(f"Total upserted daily grid rainfall rows: {grand_total}")


if __name__ == "__main__":
    main()
