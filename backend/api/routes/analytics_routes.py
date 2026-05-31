from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from backend.database.connection import fetch_all
from backend.database.connection import get_database_url
import os

router = APIRouter(prefix="/api/analytics")


def _make_geojson(features):
    return {"type": "FeatureCollection", "features": features}


@router.get("/false-onset")
def get_false_onset(baseline_start: int = Query(...), baseline_end: int = Query(...), limit: int = Query(100), offset: int = Query(0)):
    # fail fast if DB not configured
    try:
        _ = get_database_url()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    try:
        sql = """
    select f.grid_id, f.false_onset_probability, f.total_seasons, f.pipeline_run_id, st_asgeojson(gc.geom) as geom_json
    from false_onset_probability f
    left join grid_cells gc on gc.grid_id = f.grid_id
    where f.baseline_start = %(bs)s and f.baseline_end = %(be)s
    order by f.false_onset_probability desc
    limit %(limit)s offset %(offset)s
    """
        rows = fetch_all(sql, {"bs": baseline_start, "be": baseline_end, "limit": limit, "offset": offset})
        features = []
        for r in rows:
            geom = r.get("geom_json")
            properties = {k: v for k, v in r.items() if k != "geom_json"}
            features.append({"type": "Feature", "geometry": geom and __import__("json").loads(geom) or None, "properties": properties})
        return _make_geojson(features)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {e}")


@router.get("/seasonal-onset")
def get_seasonal_onset(baseline_start: int = Query(...), baseline_end: int = Query(...), limit: int = Query(100), offset: int = Query(0)):
    try:
        sql = """
        select s.grid_id, s.first_detected_onset_date, s.latest_detected_onset_date, s.seasons_analyzed, st_asgeojson(gc.geom) as geom_json
        from seasonal_onset s
        left join grid_cells gc on gc.grid_id = s.grid_id
        where s.baseline_start = %(bs)s and s.baseline_end = %(be)s
        limit %(limit)s offset %(offset)s
        """
        rows = fetch_all(sql, {"bs": baseline_start, "be": baseline_end, "limit": limit, "offset": offset})
        features = []
        for r in rows:
            geom = r.get("geom_json")
            properties = {k: v for k, v in r.items() if k != "geom_json"}
            features.append({"type": "Feature", "geometry": geom and __import__("json").loads(geom) or None, "properties": properties})
        return _make_geojson(features)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {e}")


@router.get("/onset-climatology")
def get_onset_climatology(baseline_start: int = Query(...), baseline_end: int = Query(...), limit: int = Query(100), offset: int = Query(0)):
    try:
        sql = """
        select o.grid_id, o.seasons_analyzed, st_asgeojson(gc.geom) as geom_json
        from onset_climatology o
        left join grid_cells gc on gc.grid_id = o.grid_id
        where o.baseline_start = %(bs)s and o.baseline_end = %(be)s
        limit %(limit)s offset %(offset)s
        """
        rows = fetch_all(sql, {"bs": baseline_start, "be": baseline_end, "limit": limit, "offset": offset})
        features = []
        for r in rows:
            geom = r.get("geom_json")
            properties = {k: v for k, v in r.items() if k != "geom_json"}
            features.append({"type": "Feature", "geometry": geom and __import__("json").loads(geom) or None, "properties": properties})
        return _make_geojson(features)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {e}")
