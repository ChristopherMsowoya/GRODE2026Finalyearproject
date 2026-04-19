from pathlib import Path
import json
import sys
from collections import Counter

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.api.spatial import build_district_summaries, build_ta_summaries
from backend.database.supabase_client import get_supabase_client, supabase_is_configured

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ALGORITHMS_SRC = PROJECT_ROOT / "backend" / "algorithms" / "src"
ALGORITHMS_OUTPUTS = PROJECT_ROOT / "backend" / "algorithms" / "outputs"
RESULTS_JSON_PATH = ALGORITHMS_OUTPUTS / "results.json"
DISTRICT_CACHE_PATH = ALGORITHMS_OUTPUTS / "district_summary_cache.json"
TA_CACHE_PATH = ALGORITHMS_OUTPUTS / "ta_summary_cache.json"
SHAPEFILES_ROOT = PROJECT_ROOT / "backend" / "database" / "data" / "shapefiles"

# Add algorithm src to path (lazy — pipeline imported inside handler only)
if str(ALGORITHMS_SRC) not in sys.path:
    sys.path.append(str(ALGORITHMS_SRC))


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


@app.get("/api/database/health")
def database_health_check():
    if not supabase_is_configured():
        raise HTTPException(status_code=503, detail="Supabase is not configured.")

    client = get_supabase_client()
    response = client.table("grid_cells").select("id", count="exact").limit(1).execute()
    return {"status": "ok", "grid_cell_count": response.count}


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
    if not RESULTS_JSON_PATH.exists():
        return {
            "result_count": 0,
            "seasons_analyzed": 0,
            "risk_counts": {"Low": 0, "Medium": 0, "High": 0},
            "average_false_onset_probability": 0.0,
            "average_crop_stress_probability": 0.0,
            "highest_risk_cells": [],
            "pipeline_status": "not_run",
        }

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
        "pipeline_status": "complete",
    }


@app.get("/api/results/district-summary")
def get_district_summary():
    if not RESULTS_JSON_PATH.exists():
        return {"district_count": 0, "districts": [], "pipeline_status": "not_run"}

    # Use disk cache — always serve it if the cache file exists and has districts
    if DISTRICT_CACHE_PATH.exists():
        try:
            cached = json.loads(DISTRICT_CACHE_PATH.read_text(encoding="utf-8"))
            districts = cached.get("districts", [])
            if districts:  # cache is populated
                return {
                    "district_count": len(districts),
                    "districts": districts,
                    "pipeline_status": "complete",
                }
        except Exception:
            pass

    # Cache miss — run spatial join and save
    results_mtime = RESULTS_JSON_PATH.stat().st_mtime
    district_summaries = build_district_summaries()
    DISTRICT_CACHE_PATH.write_text(
        json.dumps({"results_mtime": str(results_mtime), "districts": district_summaries}, default=str),
        encoding="utf-8",
    )
    return {
        "district_count": len(district_summaries),
        "districts": district_summaries,
        "pipeline_status": "complete",
    }


@app.get("/api/results/ta-summary")
def get_ta_summary():
    if not RESULTS_JSON_PATH.exists():
        return {"traditional_authority_count": 0, "traditional_authorities": [], "pipeline_status": "not_run"}

    if TA_CACHE_PATH.exists():
        try:
            cached = json.loads(TA_CACHE_PATH.read_text(encoding="utf-8"))
            tas = cached.get("traditional_authorities", [])
            if tas:
                return {
                    "traditional_authority_count": len(tas),
                    "traditional_authorities": tas,
                    "pipeline_status": "complete",
                }
        except Exception:
            pass

    results_mtime = RESULTS_JSON_PATH.stat().st_mtime
    ta_summaries = build_ta_summaries()
    TA_CACHE_PATH.write_text(
        json.dumps({"results_mtime": str(results_mtime), "traditional_authorities": ta_summaries}, default=str),
        encoding="utf-8",
    )
    return {
        "traditional_authority_count": len(ta_summaries),
        "traditional_authorities": ta_summaries,
        "pipeline_status": "complete",
    }


@app.get("/api/grid/ta-counts")
def get_ta_grid_counts():
    if not supabase_is_configured():
        raise HTTPException(status_code=503, detail="Supabase is not configured.")

    client = get_supabase_client()
    response = client.rpc("get_ta_grid_counts").execute()
    rows = response.data or []

    return {
        "traditional_authority_count": len(rows),
        "traditional_authorities": rows,
    }


@app.get("/api/locations/search")
def search_locations(name: str = Query(min_length=2), limit: int = Query(default=10, le=50)):
    if not supabase_is_configured():
        raise HTTPException(status_code=503, detail="Supabase is not configured.")

    client = get_supabase_client()
    response = client.rpc(
        "search_locations",
        {"name_query": name, "result_limit": limit},
    ).execute()
    rows = response.data or []

    return {
        "query": name,
        "match_count": len(rows),
        "locations": rows,
    }


@app.post("/api/pipeline/run")
def run_pipeline(payload: PipelineRunRequest):
    # Lazy import — only loads xarray/netcdf4 when the pipeline is actually triggered
    from pipeline.run_pipeline import run  # noqa: E402

    run(region=payload.region)

    results = load_results()

    return {
        "status": "completed",
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
