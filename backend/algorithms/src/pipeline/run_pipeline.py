# pipeline/run_pipeline.py

import json
from pathlib import Path
import csv
import time
import uuid
from datetime import datetime, timedelta

import numpy as np

from ingestion.chirps_loader import load_chirps
from processing.grid_extractor import DEFAULT_BOUNDS, iter_grids_fast
from utils.timeseries_utils import split_by_rainy_season
from algorithms.onset import detect_onset_details_fast
from algorithms.false_onset import calculate_false_onset_probability, false_onset_event_for_season
from algorithms.dry_spell import (
    ESTABLISHMENT_STRESS_THRESHOLDS,
    calculate_dry_spell_probability,
    calculate_dry_spell_probabilities,
    dry_spell_event_for_season,
)
from config.algorithm_config import load_algorithm_config
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
    config = load_algorithm_config()

    if not input_path.exists():
        raise FileNotFoundError(
            f"CHIRPS input not found at {input_path}. "
            f"Place one or more datasets in {RAW_DATA_DIR} or pass a filepath to run()."
        )

    resolved_bounds = resolve_bounds(region=region, bounds=bounds)
    ds = load_chirps(input_path, bounds=resolved_bounds)

    results = []

    for i, grid in enumerate(iter_grids_fast(ds)):
        seasons = split_by_rainy_season(
            grid["dates"],
            grid["rainfall"],
            start_month=config["season_start_month"],
            end_month=config["season_end_month"],
        )
        enabled_years = set(config.get("enabled_season_years") or [])
        if enabled_years:
            seasons = [season for season in seasons if season.get("season_year") in enabled_years]

        onset_dates = []
        onset_indices = []

        for season in seasons:
            onset, onset_index = detect_onset_details_fast(
                season["rainfall"],
                season["dates"],
                trigger_threshold=config["onset_trigger_mm"],
                trigger_window=config["onset_trigger_window_days"],
                persistence_window=config["persistence_window_days"],
                failure_dry_spell_days=config["persistence_dry_spell_days"],
                dry_day_threshold=config["dry_day_threshold_mm"],
            )
            onset_dates.append(onset)
            onset_indices.append(onset_index)

        false_prob = calculate_false_onset_probability(
            seasons,
            onset_indices,
            trigger_threshold=config["onset_trigger_mm"],
            trigger_window=config["onset_trigger_window_days"],
            persistence_window=config["persistence_window_days"],
            failure_dry_spell_days=config["persistence_dry_spell_days"],
        )
        dry_spell_probabilities = calculate_dry_spell_probabilities(
            seasons,
            onset_indices,
            thresholds=config["dry_spell_threshold_days"],
            window_days=config["persistence_window_days"],
            dry_day_threshold=config["dry_day_threshold_mm"],
        )
        stress_prob = dry_spell_probabilities.get(5, calculate_dry_spell_probability(seasons, onset_indices))
        valid_onset_dates = [date for date in onset_dates if date is not None]

        season_diagnostics = []
        for season_index, season in enumerate(seasons):
            onset_index = onset_indices[season_index]
            dry_events = {
                threshold: dry_spell_event_for_season(
                    season,
                    onset_index,
                    window_days=config["persistence_window_days"],
                    min_spell_length=threshold,
                    dry_day_threshold=config["dry_day_threshold_mm"],
                )
                for threshold in ESTABLISHMENT_STRESS_THRESHOLDS
            }
            dry_event = dry_events[5]
            false_event = false_onset_event_for_season(
                season,
                onset_index,
                trigger_threshold=config["onset_trigger_mm"],
                trigger_window=config["onset_trigger_window_days"],
                persistence_window=config["persistence_window_days"],
                failure_dry_spell_days=config["persistence_dry_spell_days"],
            )
            season_year = season.get("season_year")
            onset_detected = onset_index is not None

            season_diagnostics.append({
                "season_year": season_year,
                "season": season.get("season") or (str(season_year) if season_year is not None else f"S{season_index + 1}"),
                "onset_detected": onset_detected,
                "onset_probability": 1.0 if onset_detected else 0.0,
                "onset_date": str(onset_dates[season_index]) if onset_dates[season_index] is not None else None,
                "false_onset_detected": false_event["detected"],
                "false_onset_probability": 1.0 if false_event["detected"] else 0.0,
                "false_trigger_count": false_event["false_trigger_count"],
                "first_false_trigger_date": str(false_event["first_trigger_date"]) if false_event["first_trigger_date"] is not None else None,
                "first_false_trigger_rainfall_mm": false_event["first_trigger_rainfall_mm"],
                "false_onset_max_failure_dry_spell_days": false_event["max_failure_dry_spell_days"],
                "dry_spell_detected": dry_event["detected"],
                "dry_spell_probability": 1.0 if dry_event["detected"] else 0.0,
                "dry_spell_detected_5day": dry_events[5]["detected"],
                "dry_spell_detected_7day": dry_events[7]["detected"],
                "dry_spell_detected_9day": dry_events[9]["detected"],
                "dry_spell_probability_5day": 1.0 if dry_events[5]["detected"] else 0.0,
                "dry_spell_probability_7day": 1.0 if dry_events[7]["detected"] else 0.0,
                "dry_spell_probability_9day": 1.0 if dry_events[9]["detected"] else 0.0,
                "dry_spell_max_length_days": dry_event["max_dry_spell_length"],
                "dry_day_count": dry_event["dry_day_count"],
                "dry_day_threshold_mm": config["dry_day_threshold_mm"],
                "dry_spell_min_length_days": 5,
                "algorithm_config": config,
            })

        onset_timeline = build_onset_timeline(season_diagnostics)

        result = build_result(
            grid_id=f"G{i}",
            lat=grid["lat"],
            lon=grid["lon"],
            first_onset_date=valid_onset_dates[0] if valid_onset_dates else None,
            latest_onset_date=valid_onset_dates[-1] if valid_onset_dates else None,
            seasons_analyzed=len(seasons),
            seasons_with_detected_onset=len(valid_onset_dates),
            false_prob=false_prob,
            stress_prob=stress_prob,
            dry_spell_probabilities=dry_spell_probabilities,
            season_diagnostics=season_diagnostics,
            onset_timeline=onset_timeline,
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


def build_onset_timeline(season_diagnostics):
    valid = [
        diagnostic
        for diagnostic in season_diagnostics
        if diagnostic.get("onset_detected") and diagnostic.get("onset_date")
    ]
    if not valid:
        return {
            "p10_onset_date": None,
            "median_onset_date": None,
            "p90_onset_date": None,
            "onset_spread_days": None,
            "onset_variability_std": None,
            "trigger_count": 0,
            "series": [],
        }

    day_offsets = []
    for diagnostic in valid:
        onset_date = datetime.fromisoformat(str(diagnostic["onset_date"])).date()
        season_year = int(diagnostic["season_year"])
        season_start = datetime(season_year, 11, 1).date()
        day_offsets.append((onset_date - season_start).days)

    median_year = int(valid[len(valid) // 2]["season_year"])
    season_start = datetime(median_year, 11, 1).date()

    def offset_to_date(offset):
        return str(season_start + timedelta(days=int(round(offset))))

    return {
        "p10_onset_date": offset_to_date(np.percentile(day_offsets, 10)),
        "median_onset_date": offset_to_date(np.percentile(day_offsets, 50)),
        "p90_onset_date": offset_to_date(np.percentile(day_offsets, 90)),
        "onset_spread_days": int(round(np.percentile(day_offsets, 90) - np.percentile(day_offsets, 10))),
        "onset_variability_std": round(float(np.std(day_offsets)), 2),
        "trigger_count": len(valid),
        "series": [
            {
                "season": diagnostic.get("season"),
                "season_year": diagnostic.get("season_year"),
                "onset_date": diagnostic.get("onset_date"),
                "onset_probability": diagnostic.get("onset_probability", 1.0),
            }
            for diagnostic in valid
        ],
    }


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
