"""Ingest pipeline JSON results into analytic tables.

This script reads rows from `pipeline_results_json` for a given `pipeline_run_id`
and inserts aggregated values into `false_onset_probability`.

Usage:
    python -m backend.database.scripts.ingest_pipeline_results --baseline-start 1981 --baseline-end 2010
"""
from __future__ import annotations

import argparse
import json
from typing import Optional

from backend.database.connection import get_connection

LEGACY_DRY_PROBABILITY_KEY = "crop_" + "stress_probability"


def ingest(pipeline_run_id: Optional[str], baseline_start: int, baseline_end: int, algorithm_version_id: Optional[str] = None, dataset_version_id: Optional[str] = None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            if not pipeline_run_id:
                cur.execute("select pipeline_run_id from pipeline_runs order by started_at desc limit 1")
                row = cur.fetchone()
                if not row:
                    raise RuntimeError("No pipeline_runs found in DB")
                pipeline_run_id = row[0]

            cur.execute(
                "select result_id, grid_id, result from pipeline_results_json where pipeline_run_id = %(pid)s",
                {"pid": pipeline_run_id},
            )

            rows = cur.fetchall()
            if not rows:
                print("No pipeline results found for pipeline_run_id=", pipeline_run_id)
                return

            insert_sql = """
            insert into false_onset_probability (
              grid_id, baseline_start, baseline_end, false_onset_probability, total_false_events, total_seasons, dataset_version_id, algorithm_version_id, pipeline_run_id
            ) values (
              %(grid_id)s, %(baseline_start)s, %(baseline_end)s, %(prob)s, %(total_false_events)s, %(total_seasons)s, %(dataset_version_id)s, %(algorithm_version_id)s, %(pipeline_run_id)s
            )
            on conflict (grid_id, baseline_start, baseline_end, dataset_version_id, algorithm_version_id) do update
            set false_onset_probability = excluded.false_onset_probability,
                total_false_events = excluded.total_false_events,
                total_seasons = excluded.total_seasons,
                pipeline_run_id = excluded.pipeline_run_id;
            """

            count = 0
            for result_id, grid_id, result_json in rows:
                try:
                    data = json.loads(result_json) if isinstance(result_json, str) else result_json
                    prob = data.get("false_onset_probability")
                    total_seasons = data.get("seasons_analyzed") or 0
                    # total_false_events unknown from aggregated result; leave 0
                    params = {
                        "grid_id": grid_id,
                        "baseline_start": baseline_start,
                        "baseline_end": baseline_end,
                        "prob": float(prob) if prob is not None else 0.0,
                        "total_false_events": 0,
                        "total_seasons": total_seasons,
                        "dataset_version_id": dataset_version_id,
                        "algorithm_version_id": algorithm_version_id,
                        "pipeline_run_id": pipeline_run_id,
                    }
                    cur.execute(insert_sql, params)
                    count += 1
                except Exception as e:
                    print(f"Skipped result {result_id}: {e}")

        conn.commit()

    print(f"Ingested {count} false_onset_probability rows for pipeline_run {pipeline_run_id}")


def ingest_additional_tables(pipeline_run_id: str, baseline_start: int, baseline_end: int, algorithm_version_id: Optional[str] = None, dataset_version_id: Optional[str] = None):
    """Populate additional analytic tables from pipeline_results_json.

    This function attempts best-effort upserts and will not fail if tables are absent.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select result_id, grid_id, result from pipeline_results_json where pipeline_run_id = %(pid)s",
                {"pid": pipeline_run_id},
            )
            rows = cur.fetchall()

            if not rows:
                print("No pipeline results found for additional ingestion for pipeline_run_id=", pipeline_run_id)
                return

            # dry_spell_probability: accept legacy pipeline JSON while writing the scientific dry-spell table.
            dry_sql = """
            insert into dry_spell_probability (
              grid_id, baseline_start, baseline_end, dry_spell_probability, total_seasons, dataset_version_id, algorithm_version_id, pipeline_run_id
            ) values (
              %(grid_id)s, %(baseline_start)s, %(baseline_end)s, %(prob)s, %(total_seasons)s, %(dataset_version_id)s, %(algorithm_version_id)s, %(pipeline_run_id)s
            )
            on conflict (grid_id, baseline_start, baseline_end, dataset_version_id, algorithm_version_id) do update
            set dry_spell_probability = excluded.dry_spell_probability,
                total_seasons = excluded.total_seasons,
                pipeline_run_id = excluded.pipeline_run_id;
            """

            # seasonal_onset: store first/latest detected onset and seasons_analyzed
            seasonal_sql = """
            insert into seasonal_onset (
              grid_id, baseline_start, baseline_end, first_detected_onset_date, latest_detected_onset_date, seasons_analyzed, dataset_version_id, algorithm_version_id, pipeline_run_id
            ) values (
              %(grid_id)s, %(baseline_start)s, %(baseline_end)s, %(first)s, %(latest)s, %(seasons)s, %(dataset_version_id)s, %(algorithm_version_id)s, %(pipeline_run_id)s
            )
            on conflict (grid_id, baseline_start, baseline_end, dataset_version_id, algorithm_version_id) do update
            set first_detected_onset_date = excluded.first_detected_onset_date,
                latest_detected_onset_date = excluded.latest_detected_onset_date,
                seasons_analyzed = excluded.seasons_analyzed,
                pipeline_run_id = excluded.pipeline_run_id;
            """

            # onset_climatology: minimal insertion (placeholder for more advanced stats)
            climatology_sql = """
            insert into onset_climatology (
              grid_id, baseline_start, baseline_end, seasons_analyzed, dataset_version_id, algorithm_version_id, pipeline_run_id
            ) values (
              %(grid_id)s, %(baseline_start)s, %(baseline_end)s, %(seasons)s, %(dataset_version_id)s, %(algorithm_version_id)s, %(pipeline_run_id)s
            )
            on conflict (grid_id, baseline_start, baseline_end, dataset_version_id, algorithm_version_id) do update
            set seasons_analyzed = excluded.seasons_analyzed,
                pipeline_run_id = excluded.pipeline_run_id;
            """

            ingested = {"dry": 0, "seasonal": 0, "climatology": 0}

            for _rid, grid_id, result_json in rows:
                try:
                    data = json.loads(result_json) if isinstance(result_json, str) else result_json
                    seasons = data.get("seasons_analyzed") or 0
                    dry_spell_prob = data.get("dry_spell_probability", data.get(LEGACY_DRY_PROBABILITY_KEY))
                    params_common = {
                        "grid_id": grid_id,
                        "baseline_start": baseline_start,
                        "baseline_end": baseline_end,
                        "dataset_version_id": dataset_version_id,
                        "algorithm_version_id": algorithm_version_id,
                        "pipeline_run_id": pipeline_run_id,
                    }

                    # dry spell
                    try:
                        cur.execute(dry_sql, {**params_common, "prob": float(dry_spell_prob) if dry_spell_prob is not None else 0.0, "total_seasons": seasons})
                        ingested["dry"] += 1
                    except Exception:
                        # table may not exist
                        pass

                    # seasonal_onset
                    try:
                        cur.execute(seasonal_sql, {**params_common, "first": data.get("first_detected_onset_date"), "latest": data.get("latest_detected_onset_date"), "seasons": seasons})
                        ingested["seasonal"] += 1
                    except Exception:
                        pass

                    # onset_climatology
                    try:
                        cur.execute(climatology_sql, {**params_common, "seasons": seasons})
                        ingested["climatology"] += 1
                    except Exception:
                        pass

                except Exception:
                    continue

        conn.commit()

    print(f"Ingested additional tables: {ingested} for pipeline_run {pipeline_run_id}")


def main():
    parser = argparse.ArgumentParser(description="Ingest pipeline JSON results into analytic tables")
    parser.add_argument("--pipeline-run-id", dest="pipeline_run_id", help="Specific pipeline_run_id to ingest")
    parser.add_argument("--baseline-start", dest="baseline_start", type=int, required=True)
    parser.add_argument("--baseline-end", dest="baseline_end", type=int, required=True)
    parser.add_argument("--algorithm-version-id", dest="algorithm_version_id", help="algorithm_versions.algorithm_version_id to link")
    parser.add_argument("--dataset-version-id", dest="dataset_version_id", help="dataset_versions.dataset_version_id to link")

    args = parser.parse_args()

    ingest(args.pipeline_run_id, args.baseline_start, args.baseline_end, args.algorithm_version_id, args.dataset_version_id)


if __name__ == "__main__":
    main()
