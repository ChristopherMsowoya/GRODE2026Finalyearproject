from pathlib import Path
import json
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.api.spatial import build_district_summaries, build_ta_summaries

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / "backend" / ".env")

try:
    from backend.api.routes.supabase_routes import router as supabase_router
except Exception:
    supabase_router = None

# Only mark Supabase as available if the supabase client can be imported.
try:
    import importlib
    importlib.import_module("backend.src.supabase_client")
    SUPABASE_AVAILABLE = True
except Exception:
    SUPABASE_AVAILABLE = False

from backend.api.routes.grid_routes import router as grid_router
from backend.api.routes.ingest_routes import router as ingest_router
from backend.api.routes.analytics_routes import router as analytics_router

ALGORITHMS_SRC = PROJECT_ROOT / "backend" / "algorithms" / "src"
ALGORITHMS_OUTPUTS = PROJECT_ROOT / "backend" / "algorithms" / "outputs"
RESULTS_JSON_PATH = ALGORITHMS_OUTPUTS / "results.json"
SHAPEFILES_ROOT = PROJECT_ROOT / "backend" / "database" / "data" / "shapefiles"

if str(ALGORITHMS_SRC) not in sys.path:
    sys.path.append(str(ALGORITHMS_SRC))

from backend.src.pipeline.run_pipeline import run


class PipelineRunRequest(BaseModel):
    region: str = "malawi"


app = FastAPI(
    title="GRODE Backend API",
    description="API for rainfall-risk pipeline execution and result retrieval.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if SUPABASE_AVAILABLE and supabase_router:
    app.include_router(supabase_router)

app.include_router(grid_router)
app.include_router(ingest_router)
app.include_router(analytics_router)


@app.get("/")
def root():
    return {
        "message": "GRODE FastAPI backend is running.",
        "docs": "/docs",
        "health": "/api/health",
        "results": "/api/results",
        "run_pipeline": "/api/pipeline/run",
    }


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/results")
def get_results():
    return load_results()


@app.get("/api/boundaries/{level}")
def get_boundaries(level: str, simplified: bool = Query(default=True)):
    boundary_files = {
        "country": SHAPEFILES_ROOT / "ADM0(country)",
        "regions": SHAPEFILES_ROOT / "ADM1(region)",
        "districts": SHAPEFILES_ROOT / "ADM2(district)",
        "traditional-authorities": SHAPEFILES_ROOT / "ADM3(TA)",
    }

    if level not in boundary_files:
        raise HTTPException(
            status_code=404,
            detail="Unknown boundary level. Use country, regions, districts, or traditional-authorities.",
        )

    folder = boundary_files[level]
    suffix = "_simplified.geojson" if simplified else ".geojson"
    candidates = sorted(folder.glob(f"*{suffix}"))

    if not candidates:
        raise HTTPException(
            status_code=404,
            detail=f"No GeoJSON file found for boundary level '{level}'.",
        )

    with candidates[0].open("r", encoding="utf-8") as boundary_file:
        return json.load(boundary_file)


@app.get("/api/results/summary")
def get_results_summary():
    results = load_results()

    risk_counts = Counter(result["overall_risk_level"] for result in results)
    average_false_onset_probability = round(
        sum(result["false_onset_probability"] for result in results) / len(results),
        3,
    )
    average_crop_stress_probability = round(
        sum(result["crop_stress_probability"] for result in results) / len(results),
        3,
    )
    seasons_analyzed = max(result["seasons_analyzed"] for result in results)

    highest_risk_cells = sorted(
        results,
        key=lambda result: (
            result["crop_stress_probability"],
            result["false_onset_probability"],
        ),
        reverse=True,
    )[:5]

    return {
        "result_count": len(results),
        "seasons_analyzed": seasons_analyzed,
        "risk_counts": {
            "Low": risk_counts.get("Low", 0),
            "Medium": risk_counts.get("Medium", 0),
            "High": risk_counts.get("High", 0),
        },
        "average_false_onset_probability": average_false_onset_probability,
        "average_crop_stress_probability": average_crop_stress_probability,
        "highest_risk_cells": highest_risk_cells,
    }


@app.get("/api/results/district-summary")
def get_district_summary():
    district_summaries = build_district_summaries()
    return {
        "district_count": len(district_summaries),
        "districts": district_summaries,
    }


@app.get("/api/results/ta-summary")
def get_ta_summary():
    ta_summaries = build_ta_summaries()
    return {
        "traditional_authority_count": len(ta_summaries),
        "traditional_authorities": ta_summaries,
    }


# Compatibility adapter endpoints for the frontend (legacy paths)


@app.get("/api/pipeline-results")
def get_pipeline_results():
    return get_results()


@app.get("/api/pipeline-results/summary")
def get_pipeline_results_summary():
    return get_results_summary()


@app.get("/api/pipeline-results/district-summary")
def get_pipeline_results_district_summary():
    return get_district_summary()


@app.get("/api/pipeline-results/ta-summary")
def get_pipeline_results_ta_summary():
    return get_ta_summary()


@app.get("/api/database/health")
def api_database_health():
    return health_check()


@app.post("/api/pipeline/run")
def run_pipeline(payload: PipelineRunRequest):
    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()

    # Run the algorithm pipeline
    run(region=payload.region)
    results = load_results()

    completed_at = datetime.now(timezone.utc).isoformat()

    # Write to DB if Supabase is available
    if SUPABASE_AVAILABLE:
        try:
            from backend.src.supabase_client import supabase

            # Log pipeline run
            supabase.table("pipeline_runs").insert({
                "pipeline_run_id": run_id,
                "run_name": f"pipeline-{payload.region}-{started_at[:10]}",
                "status": "completed",
                "region": payload.region,
                "started_at": started_at,
                "completed_at": completed_at,
                "metadata": {"result_count": len(results)}
            }).execute()

            # Write each result to pipeline_results_json
            rows = [
                {
                    "pipeline_run_id": run_id,
                    "grid_id": r.get("grid_id"),
                    "result": r
                }
                for r in results
            ]
            supabase.table("pipeline_results_json").insert(rows).execute()

        except Exception as e:
            print(f"Warning: Could not write to DB: {e}")

    return {
        "status": "completed",
        "run_id": run_id,
        "region": payload.region,
        "result_count": len(results),
        "results_path": str(RESULTS_JSON_PATH),
    }


def load_results():
    if not RESULTS_JSON_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No pipeline results found. Run the pipeline first.",
        )

    with RESULTS_JSON_PATH.open("r", encoding="utf-8") as results_file:
        return json.load(results_file)