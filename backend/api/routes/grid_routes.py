import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from backend.database.connection import fetch_all, fetch_one

router = APIRouter(prefix="/api/grid", tags=["grid"])
LEGACY_DRY_PROBABILITY_KEY = "crop_" + "stress_probability"
LEGACY_DRY_INTERPRETATION_KEY = "crop_" + "stress_interpretation"
PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_RESULTS_PATH = PROJECT_ROOT / "backend" / "algorithms" / "outputs" / "results.json"
GRID_HALF_SIZE_DEGREES = 0.125
USE_DATABASE_GRID_API = os.environ.get("GRID_API_SOURCE", "local").lower() in {"db", "database", "postgres", "postgis"}


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


def _load_local_results() -> list[dict]:
    if not LOCAL_RESULTS_PATH.exists():
        return []

    return _load_local_results_cached(LOCAL_RESULTS_PATH.stat().st_mtime_ns)


@lru_cache(maxsize=2)
def _load_local_results_cached(_mtime_ns: int) -> list[dict]:
    with LOCAL_RESULTS_PATH.open("r", encoding="utf-8") as results_file:
        rows = json.load(results_file)

    normalized = []
    for row in rows:
        result = dict(row)
        if "dry_spell_probability" not in result:
            result["dry_spell_probability"] = result.get(LEGACY_DRY_PROBABILITY_KEY, 0.0)
        if "dry_spell_interpretation" not in result:
            result["dry_spell_interpretation"] = result.get(LEGACY_DRY_INTERPRETATION_KEY)
        result.pop(LEGACY_DRY_PROBABILITY_KEY, None)
        result.pop(LEGACY_DRY_INTERPRETATION_KEY, None)
        normalized.append(result)

    return normalized


def _local_result_to_feature(result: dict) -> dict:
    lon = float(result.get("longitude") or result.get("centroid_lon") or 0)
    lat = float(result.get("latitude") or result.get("centroid_lat") or 0)
    grid_id = str(result.get("grid_id", ""))
    min_lon = lon - GRID_HALF_SIZE_DEGREES
    max_lon = lon + GRID_HALF_SIZE_DEGREES
    min_lat = lat - GRID_HALF_SIZE_DEGREES
    max_lat = lat + GRID_HALF_SIZE_DEGREES

    properties = {
        **result,
        "grid_id": grid_id,
        "grid_code": result.get("grid_code") or grid_id,
        "centroid_lat": lat,
        "centroid_lon": lon,
        "source_grid": result.get("source_grid") or "local-results",
        "onset_probability": (
            (result.get("seasons_with_detected_onset") or 0)
            / max(1, result.get("seasons_analyzed") or 1)
        ),
    }

    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [min_lon, min_lat],
                [max_lon, min_lat],
                [max_lon, max_lat],
                [min_lon, max_lat],
                [min_lon, min_lat],
            ]],
        },
        "properties": properties,
    }


def _local_feature_collection(limit: int = 5000, offset: int = 0) -> dict:
    if not LOCAL_RESULTS_PATH.exists():
        return {"type": "FeatureCollection", "count": 0, "features": [], "source": "local-results"}
    return _local_feature_collection_cached(limit, offset, LOCAL_RESULTS_PATH.stat().st_mtime_ns)


@lru_cache(maxsize=8)
def _local_feature_collection_cached(limit: int = 5000, offset: int = 0, _mtime_ns: int = 0) -> dict:
    rows = _load_local_results()
    page = rows[offset:offset + limit]
    return {
        "type": "FeatureCollection",
        "count": len(page),
        "features": [_local_result_to_feature(row) for row in page],
        "source": "local-results",
    }


def _history_from_result(grid_id: str, result: dict) -> dict:
    diagnostics = result.get("season_diagnostics") or []

    if not diagnostics:
        years = []
        for key in ("first_detected_onset_date", "latest_detected_onset_date"):
            value = result.get(key)
            if isinstance(value, str) and len(value) >= 4 and value[:4].isdigit():
                years.append(int(value[:4]))
        seasons = int(result.get("seasons_analyzed") or 1)
        if years:
            years = list(range(min(years), min(years) + seasons))
        diagnostics = [
            {
                "season": str(years[index]) if index < len(years) else f"S{index + 1}",
                "season_year": years[index] if index < len(years) else None,
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
    rows = _load_local_results()
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
    if not USE_DATABASE_GRID_API:
        return _local_feature_collection(limit, offset)

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

    try:
        rows = fetch_all(sql, params)
        return _feature_collection(rows)
    except Exception:
        return _local_feature_collection(limit, offset)


@router.get("/diagnostic-cells")
def list_diagnostic_grid_cells(limit: int = Query(5000, ge=1, le=20000), offset: int = 0, source_grid: Optional[str] = None):
    if not USE_DATABASE_GRID_API:
        return _local_feature_collection(limit, offset)

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

    try:
        rows = fetch_all(sql, params)
        return _feature_collection(rows)
    except Exception:
        return _local_feature_collection(limit, offset)


@router.get("/cells/{grid_id}")
def get_grid_cell(grid_id: str):
    if not USE_DATABASE_GRID_API:
        local = next((row for row in _load_local_results() if str(row.get("grid_id")) == str(grid_id)), None)
        if local:
            return _local_result_to_feature(local)
        raise HTTPException(status_code=404, detail="Grid cell not found")

    sql = _diagnostic_select_sql() + " where gc.grid_id = %(grid_id)s"
    try:
        row = fetch_one(sql, {
            "grid_id": grid_id,
            "legacy_dry_probability_key": LEGACY_DRY_PROBABILITY_KEY,
            "legacy_dry_interpretation_key": LEGACY_DRY_INTERPRETATION_KEY,
        })
        if row:
            return _row_to_feature(row)
    except Exception:
        pass

    local = next((row for row in _load_local_results() if str(row.get("grid_id")) == str(grid_id)), None)
    if local:
        return _local_result_to_feature(local)

    raise HTTPException(status_code=404, detail="Grid cell not found")


@router.get("/ta-counts")
def get_ta_grid_counts():
    from backend.api.spatial import build_ta_summaries

    summaries = build_ta_summaries()
    rows = [
        {
            "traditional_authority": row["traditional_authority"],
            "district": row.get("district"),
            "grid_cell_count": row["grid_cell_count"],
        }
        for row in summaries
    ]

    return {
        "traditional_authority_count": len(rows),
        "traditional_authorities": rows,
    }


@router.get("/cells/{grid_id}/history")
def get_grid_cell_history(grid_id: str):
    if not USE_DATABASE_GRID_API:
        local = _local_history(grid_id)
        if local:
            return local
        return {"grid_id": grid_id, "season_count": 0, "seasons": []}

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
    if not USE_DATABASE_GRID_API:
        return {"count": 0, "rows": [], "source": "local-results"}

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

    try:
        rows = fetch_all(sql, params)
        return {"count": len(rows), "rows": rows}
    except Exception:
        return {"count": 0, "rows": [], "source": "local-results"}
