from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from backend.database.connection import fetch_all, fetch_one

router = APIRouter(prefix="/api/grid", tags=["grid"])


@router.get("/cells")
def list_grid_cells(limit: int = Query(100, ge=1, le=1000), offset: int = 0, source_grid: Optional[str] = None):
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
    return {"count": len(rows), "rows": rows}


@router.get("/cells/{grid_id}")
def get_grid_cell(grid_id: str):
    sql = (
        "select grid_id, grid_code, centroid_lat, centroid_lon, area_km2, source_grid, "
        "st_asgeojson(geom) as geom from grid_cells where grid_id = %(grid_id)s"
    )
    row = fetch_one(sql, {"grid_id": grid_id})
    if not row:
        raise HTTPException(status_code=404, detail="Grid cell not found")
    return row


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
