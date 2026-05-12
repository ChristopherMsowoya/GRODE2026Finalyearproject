from fastapi import APIRouter, HTTPException, Query
from typing import Optional

router = APIRouter(prefix="/api", tags=["database"])


def _get_supabase():
    try:
        from backend.src.supabase_client import supabase
        return supabase
    except Exception:
        raise HTTPException(status_code=503, detail="Supabase client not available.")


# ── Grid Cells ───────────────────────────────────────────────
@router.get("/grid-cells")
async def get_grid_cells(
    limit: int = Query(default=100, ge=1, le=10000),
    region: Optional[str] = Query(default=None)
):
    supabase = _get_supabase()
    query = supabase.table("grid_cells").select("*").limit(limit)
    if region:
        query = query.eq("region", region)
    res = query.execute()
    return {"count": len(res.data), "data": res.data}


# ── Grid Cell by ID ──────────────────────────────────────────
@router.get("/grid-cells/{grid_id}")
async def get_grid_cell(grid_id: str):
    supabase = _get_supabase()
    res = supabase.table("grid_cells").select("*").eq("grid_id", grid_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail=f"Grid cell {grid_id} not found.")
    return res.data[0]


# ── Admin Intersections ──────────────────────────────────────
@router.get("/admin-intersections")
async def get_admin_intersections(
    grid_id: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=10000)
):
    supabase = _get_supabase()
    query = supabase.table("grid_admin_intersections").select("*").limit(limit)
    if grid_id:
        query = query.eq("grid_id", grid_id)
    if district:
        query = query.eq("district_name", district)
    res = query.execute()
    return {"count": len(res.data), "data": res.data}


# ── Pipeline Runs ────────────────────────────────────────────
@router.get("/pipeline-runs")
async def get_pipeline_runs(
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None)
):
    supabase = _get_supabase()
    query = supabase.table("pipeline_runs").select("*").order("completed_at", desc=True).limit(limit)
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return {"count": len(res.data), "data": res.data}


@router.get("/pipeline-runs/{run_id}")
async def get_pipeline_run(run_id: str):
    supabase = _get_supabase()
    res = supabase.table("pipeline_runs").select("*").eq("pipeline_run_id", run_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail=f"Pipeline run {run_id} not found.")
    return res.data[0]


# ── Pipeline Results ─────────────────────────────────────────
@router.get("/pipeline-results")
async def get_pipeline_results(
    pipeline_run_id: Optional[str] = Query(default=None),
    grid_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=10000)
):
    """Fetch pipeline results, optionally filtered by run or grid cell."""
    supabase = _get_supabase()
    query = supabase.table("pipeline_results_json").select("*").limit(limit)
    if pipeline_run_id:
        query = query.eq("pipeline_run_id", pipeline_run_id)
    if grid_id:
        query = query.eq("grid_id", grid_id)
    res = query.execute()
    return {"count": len(res.data), "data": res.data}