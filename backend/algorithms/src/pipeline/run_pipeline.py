# pipeline/run_pipeline.py

import json
from pathlib import Path
import csv
import time
import uuid
from datetime import datetime

from ingestion.chirps_loader import load_chirps
from processing.grid_extractor import DEFAULT_BOUNDS, iter_grids_fast
from utils.timeseries_utils import split_by_year
from algorithms.onset import detect_onset_details_fast
from algorithms.false_onset import calculate_false_onset_fast
from algorithms.crop_stress import calculate_stress_fast
from models.result_schema import build_result

# DB integration: write pipeline run + per-grid JSON results linked to nearest grid_cells
try:
    from backend.database.connection import get_connection
except Exception:
    get_connection = None

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
OUTPUT_DIR = PROJECT_ROOT / "outputs"
JSON_OUTPUT_PATH = OUTPUT_DIR / "results.json"
CSV_OUTPUT_PATH = OUTPUT_DIR / "results.csv"


def resolve_input_path(filepath=None):
    if filepath:
        return Path(filepath).expanduser().resolve()
    return RAW_DATA_DIR.resolve()


def resolve_bounds(region=None, bounds=None):
    if bounds:
        return bounds

    if region is None:
        region = "malawi"

    if region == "global":
        return None

    if region not in DEFAULT_BOUNDS:
        raise ValueError(
            f"Unknown region '{region}'. Available regions: {', '.join(sorted(DEFAULT_BOUNDS))}, global."
        )

    return DEFAULT_BOUNDS[region]


def run(filepath=None, region="malawi", bounds=None):
    input_path = resolve_input_path(filepath)

    if not input_path.exists():
        raise FileNotFoundError(
            f"CHIRPS input not found at {input_path}. "
            f"Place one or more datasets in {RAW_DATA_DIR} or pass a filepath to run()."
        )

    resolved_bounds = resolve_bounds(region=region, bounds=bounds)
    ds = load_chirps(input_path, bounds=resolved_bounds)

    results = []

    for i, grid in enumerate(iter_grids_fast(ds)):
        seasons = split_by_year(grid["dates"], grid["rainfall"])

        onset_dates = []
        onset_indices = []

        for season in seasons:
            onset, onset_index = detect_onset_details_fast(
                season["rainfall"],
                season["dates"]
            )
            onset_dates.append(onset)
            onset_indices.append(onset_index)

        false_prob = calculate_false_onset_fast(seasons, onset_indices)
        stress_prob = calculate_stress_fast(seasons, onset_indices)
        valid_onset_dates = [date for date in onset_dates if date is not None]

        result = build_result(
            grid_id=f"G{i}",
            lat=grid["lat"],
            lon=grid["lon"],
            first_onset_date=valid_onset_dates[0] if valid_onset_dates else None,
            latest_onset_date=valid_onset_dates[-1] if valid_onset_dates else None,
            seasons_analyzed=len(seasons),
            seasons_with_detected_onset=len(valid_onset_dates),
            false_prob=false_prob,
            stress_prob=stress_prob
        )

        results.append(result)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with JSON_OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)

    write_csv(results, CSV_OUTPUT_PATH)

    print(
        f"Pipeline completed successfully for region={region}. "
        f"Results written to {JSON_OUTPUT_PATH} and {CSV_OUTPUT_PATH}"
    )

    # If DB integration is available, write a pipeline_runs entry and save results
    if get_connection:
        try:
            pipeline_run_id = save_pipeline_run(output_uri=str(JSON_OUTPUT_PATH))
            save_results_json(pipeline_run_id, results)
        except Exception as e:
            print(f"Warning: failed to write pipeline results to DB: {e}")


def write_csv(results, output_path):
    if not results:
        output_path.write_text("", encoding="utf-8")
        return

    fieldnames = list(results[0].keys())

    for attempt in range(3):
        try:
            with output_path.open("w", encoding="utf-8", newline="") as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(results)
            return
        except PermissionError:
            if attempt == 2:
                raise
            time.sleep(1)


if __name__ == "__main__":
    run()


def save_pipeline_run(run_name: str = None, output_uri: str | None = None) -> str:
    """Insert a row into pipeline_runs and return the pipeline_run_id."""
    if run_name is None:
        run_name = f"run-{datetime.utcnow().isoformat()}"

    insert_sql = """
    insert into pipeline_runs (pipeline_run_id, run_name, output_uri, status, completed_at)
    values (%(id)s, %(run_name)s, %(output_uri)s, 'completed', now())
    on conflict (pipeline_run_id) do update set status = excluded.status
    returning pipeline_run_id
    """

    pid = str(uuid.uuid4())
    params = {"id": pid, "run_name": run_name, "output_uri": output_uri}

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(insert_sql, params)
            row = cursor.fetchone()
            if row:
                return row[0]

    return pid


def save_results_json(pipeline_run_id: str, results: list):
    """Create `pipeline_results_json` table if missing and insert each result as jsonb.
    Attempt to link each result to nearest `grid_cells.grid_id` using KNN.
    """
    create_sql = """
    create table if not exists pipeline_results_json (
      result_id uuid primary key default gen_random_uuid(),
      pipeline_run_id uuid references pipeline_runs(pipeline_run_id) on delete cascade,
      grid_id text references grid_cells(grid_id),
      result jsonb not null,
      created_at timestamptz not null default now()
    );
    """

    insert_sql = """
    insert into pipeline_results_json (pipeline_run_id, grid_id, result)
    values (%(pipeline_run_id)s, %(grid_id)s, %(result)s::jsonb)
    """

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(create_sql)

            for r in results:
                grid_id = None
                try:
                    # find nearest grid cell by centroid
                    q = "select grid_id from grid_cells order by geom <-> st_setsrid(st_point(%(lon)s, %(lat)s), 4326) limit 1"
                    cursor.execute(q, {"lon": r.get("longitude"), "lat": r.get("latitude")})
                    row = cursor.fetchone()
                    if row:
                        grid_id = row[0]
                except Exception:
                    grid_id = None

                cursor.execute(insert_sql, {
                    "pipeline_run_id": pipeline_run_id,
                    "grid_id": grid_id,
                    "result": json.dumps(r)
                })
        connection.commit()
