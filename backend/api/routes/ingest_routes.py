from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.database.scripts.ingest_pipeline_results import ingest, ingest_additional_tables

router = APIRouter(prefix="/api/pipeline")

class IngestRequest(BaseModel):
    pipeline_run_id: Optional[str] = None
    baseline_start: int = 1981
    baseline_end: int = 2010
    algorithm_version_id: Optional[str] = None
    dataset_version_id: Optional[str] = None


@router.post("/ingest")
def ingest_endpoint(payload: IngestRequest):
    try:
        ingest(payload.pipeline_run_id, payload.baseline_start, payload.baseline_end, payload.algorithm_version_id, payload.dataset_version_id)
        # populate additional tables
        if payload.pipeline_run_id:
            ingest_additional_tables(payload.pipeline_run_id, payload.baseline_start, payload.baseline_end, payload.algorithm_version_id, payload.dataset_version_id)
        return {"status": "ok", "pipeline_run_id": payload.pipeline_run_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
