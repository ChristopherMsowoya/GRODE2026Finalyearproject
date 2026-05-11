from fastapi import APIRouter, HTTPException, Query
from backend.src.supabase_client import supabase

router = APIRouter(prefix="/supabase", tags=["supabase"])


@router.get('/{table_name}')
async def fetch_table(table_name: str, limit: int = Query(default=100, ge=1, le=10000)):
    """Fetch rows from a Supabase table. Use `limit` to restrict result size for testing."""
    try:
        res = supabase.table(table_name).select('*').limit(limit).execute()
        if res.error:
            raise Exception(res.error)
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
