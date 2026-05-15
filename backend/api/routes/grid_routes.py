import json
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from backend.database.connection import fetch_all, fetch_one

router = APIRouter(prefix="/api/grid", tags=["grid"])
LEGACY_DRY_PROBABILITY_KEY = "crop_" + "stress_probability"
LEGACY_DRY_INTERPRETATION_KEY = "crop_" + "stress_interpretation"
PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_RESULTS_PATH = PROJECT_ROOT / "backend" / "algorithms" / "outputs" / "results.json"


def _row_to_feature(row: dict) -> dict:
    geom = row.pop("geom", None)
    return {
        "type": "Feature",
        "geometry": json.loads(geom) if isinstance(geom, str) and geom else geom,
        "properties": row,
    }


def _feature_collection(rows: list[dict]) -> dict:
    return {
        "type": "FeatureCollection",
        "count": len(rows),
        "features": [_row_to_feature(dict(row)) for row in rows],
    }


def _history_from_result(grid_id: str, result: dict) -> dict:
    diagnostics = result.get("season_diagnostics") or []

    if not diagnostics:
        seasons = int(result.get("seasons_analyzed") or 1)
        diagnostics = [
            {
                "season": f"S{index + 1}",
                "season_year": None,
                "onset_probability": result.get("onset_probability")
                    or (
                        (result.get("seasons_with_detected_onset") or 0)
                        / max(1, result.get("seasons_analyzed") or 1)
                    ),
                "false_onset_probability": result.get("false_onset_probability", 0),
                "dry_spell_probability": result.get(
                    "dry_spell_probability",
                    result.get(LEGACY_DRY_PROBABILITY_KEY, 0),
                ),
            }
            for index in range(seasons)
        ]

    return {
        "grid_id": grid_id,
        "season_count": len(diagnostics),
        "seasons": diagnostics,
    }


def _local_history(grid_id: str) -> dict | None:
    if not LOCAL_RESULTS_PATH.exists():
        return None

    with LOCAL_RESULTS_PATH.open("r", encoding="utf-8") as results_file:
        rows = json.load(results_file)

    match = next((row for row in rows if str(row.get("grid_id")) == str(grid_id)), None)
    if not match:
        return None

    return _history_from_result(grid_id, match)


def _diagnostic_select_sql() -> str:
    return """
        select
            gc.grid_id,
            gc.grid_code,
            gc.centroid_lat,
            gc.centroid_lon,
            gc.area_km2,
            gc.source_grid,
            district.shape_name as district_name,
            nullif(latest.result->>'seasons_analyzed', '')::integer as seasons_analyzed,
            nullif(latest.result->>'seasons_with_detected_onset', '')::integer as seasons_with_detected_onset,
            latest.result->>'first_detected_onset_date' as first_detected_onset_date,
            latest.result->>'latest_detected_onset_date' as latest_detected_onset_date,
            coalesce(nullif(latest.result->>'false_onset_probability', '')::double precision, 0) as false_onset_probability,
            coalesce(
                nullif(latest.result->>'dry_spell_probability', '')::double precision,
                nullif(latest.result->>%(legacy_dry_probability_key)s, '')::double precision,
                0
            ) as dry_spell_probability,
            case
                when nullif(latest.result->>'seasons_analyzed', '')::double precision > 0
                    then nullif(latest.result->>'seasons_with_detected_onset', '')::double precision
                         / nullif(latest.result->>'seasons_analyzed', '')::double precision
                else 0
            end as onset_probability,
            latest.result->>'false_onset_interpretation' as false_onset_interpretation,
            coalesce(
                latest.result->>'dry_spell_interpretation',
                latest.result->>%(legacy_dry_interpretation_key)s
            ) as dry_spell_interpretation,
            st_asgeojson(gc.geom) as geom
        from grid_cells gc
        left join lateral (
            select ab.shape_name
            from admin_boundaries ab
            where ab.admin_level = 2
              and st_intersects(ab.geom, st_centroid(gc.geom))
            order by st_area(st_intersection(ab.geom, gc.geom)) desc
            limit 1
        ) district on true
        left join lateral (
            select pr.result
            from pipeline_results_json pr
            where pr.grid_id = gc.grid_id
            order by pr.created_at desc
            limit 1
        ) latest on true
    """


@router.get("/cells")
def list_grid_cells(limit: int = Query(5000, ge=1, le=20000), offset: int = 0, source_grid: Optional[str] = None):
    sql = (
        "select grid_id, grid_code, centroid_lat, centroid_lon, area_km2, source_grid, "
        "st_asgeojson(geom) as geom from grid_cells"
    )
    params = {}
    if source_grid:
        sql += " where source_grid = %(source_grid)s"
        params["source_grid"] = source_grid

    sql += " order by grid_id limit %(limit)s offset %(offset)s"
    params.update({"limit": limit, "offset": offset})

    rows = fetch_all(sql, params)
    return _feature_collection(rows)


@router.get("/diagnostic-cells")
def list_diagnostic_grid_cells(limit: int = Query(5000, ge=1, le=20000), offset: int = 0, source_grid: Optional[str] = None):
    sql = _diagnostic_select_sql()
    params = {
        "legacy_dry_probability_key": LEGACY_DRY_PROBABILITY_KEY,
        "legacy_dry_interpretation_key": LEGACY_DRY_INTERPRETATION_KEY,
    }
    filters = []

    if source_grid:
        filters.append("gc.source_grid = %(source_grid)s")
        params["source_grid"] = source_grid

    if filters:
        sql += " where " + " and ".join(filters)

    sql += " order by gc.grid_id limit %(limit)s offset %(offset)s"
    params.update({"limit": limit, "offset": offset})

    rows = fetch_all(sql, params)
    return _feature_collection(rows)


@router.get("/cells/{grid_id}")
def get_grid_cell(grid_id: str):
    sql = _diagnostic_select_sql() + " where gc.grid_id = %(grid_id)s"
    row = fetch_one(sql, {
        "grid_id": grid_id,
        "legacy_dry_probability_key": LEGACY_DRY_PROBABILITY_KEY,
        "legacy_dry_interpretation_key": LEGACY_DRY_INTERPRETATION_KEY,
    })
    if not row:
        raise HTTPException(status_code=404, detail="Grid cell not found")
    return _row_to_feature(row)


@router.get("/cells/{grid_id}/history")
def get_grid_cell_history(grid_id: str):
    try:
        row = fetch_one(
            """
            select result
            from pipeline_results_json
            where grid_id = %(grid_id)s
            order by created_at desc
            limit 1
            """,
            {"grid_id": grid_id},
        )
    except Exception:
        row = None

    if row and row.get("result"):
        result = row["result"]
        if isinstance(result, str):
            result = json.loads(result)
        return _history_from_result(grid_id, result)

    local = _local_history(grid_id)
    if local:
        return local

    return {"grid_id": grid_id, "season_count": 0, "seasons": []}


@router.get("/intersections")
def list_intersections(limit: int = Query(500, ge=1, le=5000), offset: int = 0, grid_id: Optional[str] = None, admin_boundary_id: Optional[str] = None):
    sql = (
        "select grid_id, admin_boundary_id, overlap_area_km2, overlap_fraction "
        "from grid_admin_intersections"
    )
    params = {}
    filters = []
    if grid_id:
        filters.append("grid_id = %(grid_id)s")
        params["grid_id"] = grid_id
    if admin_boundary_id:
        filters.append("admin_boundary_id = %(admin_boundary_id)s")
        params["admin_boundary_id"] = admin_boundary_id

    if filters:
        sql += " where " + " and ".join(filters)

    sql += " order by grid_id limit %(limit)s offset %(offset)s"
    params.update({"limit": limit, "offset": offset})

    rows = fetch_all(sql, params)
    return {"count": len(rows), "rows": rows}
