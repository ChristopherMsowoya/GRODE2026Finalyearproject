# pipeline/run_pipeline.py

import json
from pathlib import Path
import csv

from ingestion.chirps_loader import load_chirps
from processing.grid_extractor import DEFAULT_BOUNDS, iter_grids_fast, subset_dataset
from utils.timeseries_utils import split_by_year
from algorithms.onset import detect_onset_details_fast
from algorithms.false_onset import calculate_false_onset_fast
from algorithms.crop_stress import calculate_stress_fast
from models.result_schema import build_result

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

    ds = load_chirps(input_path)
    ds = subset_dataset(ds, resolve_bounds(region=region, bounds=bounds))

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


def write_csv(results, output_path):
    if not results:
        output_path.write_text("", encoding="utf-8")
        return

    fieldnames = list(results[0].keys())

    with output_path.open("w", encoding="utf-8", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)


if __name__ == "__main__":
    run()
