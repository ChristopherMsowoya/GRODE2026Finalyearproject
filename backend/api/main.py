from pathlib import Path
import json
import os
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.api.spatial import build_district_summaries, build_ta_summaries, get_grids_for_ta, search_places

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / "backend" / ".env")

try:
    from backend.api.routes.supabase_routes import router as supabase_router
except Exception as e:
    print(f"Warning: Supabase routes unavailable: {e}")
    supabase_router = None

# Supabase is optional for the local diagnostic engine. Avoid importing the
# client at startup because it can block normal map/dashboard reads.
SUPABASE_AVAILABLE = os.environ.get("ENABLE_SUPABASE_WRITES", "").lower() in {"1", "true", "yes"}

# Try to import database-backed routes, but continue if database isn't available
try:
    from backend.api.routes.grid_routes import router as grid_router
except Exception as e:
    print(f"Warning: Grid routes unavailable: {e}")
    grid_router = None

try:
    from backend.api.routes.ingest_routes import router as ingest_router
except Exception as e:
    print(f"Warning: Ingest routes unavailable: {e}")
    ingest_router = None

try:
    from backend.api.routes.analytics_routes import router as analytics_router
except Exception as e:
    print(f"Warning: Analytics routes unavailable: {e}")
    analytics_router = None

ALGORITHMS_SRC = PROJECT_ROOT / "backend" / "algorithms" / "src"
ALGORITHMS_OUTPUTS = PROJECT_ROOT / "backend" / "algorithms" / "outputs"
RESULTS_JSON_PATH = ALGORITHMS_OUTPUTS / "results.json"
SHAPEFILES_ROOT = PROJECT_ROOT / "backend" / "database" / "data" / "shapefiles"

if str(ALGORITHMS_SRC) not in sys.path:
    sys.path.append(str(ALGORITHMS_SRC))

from backend.src.pipeline.run_pipeline import run


LEGACY_DRY_PROBABILITY_KEY = "crop_" + "stress_probability"
LEGACY_DRY_INTERPRETATION_KEY = "crop_" + "stress_interpretation"


def dry_spell_probability(result: dict) -> float:
    return result.get("dry_spell_probability", result.get(LEGACY_DRY_PROBABILITY_KEY, 0.0))


def extract_available_years(results: list[dict]) -> list[int]:
    years = set()
    for result in results:
        for diagnostic in result.get("season_diagnostics") or []:
            year = diagnostic.get("season_year") or diagnostic.get("year")
            if isinstance(year, int):
                years.add(year)
            elif isinstance(year, str) and year.isdigit():
                years.add(int(year))

        for key in ("first_detected_onset_date", "latest_detected_onset_date"):
            value = result.get(key)
            if isinstance(value, str) and len(value) >= 4 and value[:4].isdigit():
                years.add(int(value[:4]))

        first = result.get("first_detected_onset_date")
        latest = result.get("latest_detected_onset_date")
        seasons = int(result.get("seasons_analyzed") or 0)
        if (
            seasons > 1
            and isinstance(first, str)
            and isinstance(latest, str)
            and len(first) >= 4
            and len(latest) >= 4
            and first[:4].isdigit()
            and latest[:4].isdigit()
        ):
            start_year = int(first[:4])
            end_year = int(latest[:4])
            if end_year >= start_year:
                years.update(range(start_year, end_year + 1))

    return sorted(years)


def build_season_diagnostics_from_result(result: dict) -> list[dict]:
    diagnostics = result.get("season_diagnostics") or []
    if diagnostics:
        return diagnostics

    years = extract_available_years([result])
    seasons = int(result.get("seasons_analyzed") or len(years) or 1)
    if len(years) != seasons and years:
        years = list(range(years[0], years[0] + seasons))

    return [
        {
            "season": str(years[index]) if index < len(years) else f"S{index + 1}",
            "season_year": years[index] if index < len(years) else None,
            "onset_probability": result.get("onset_probability")
            or (
                (result.get("seasons_with_detected_onset") or 0)
                / max(1, result.get("seasons_analyzed") or 1)
            ),
            "false_onset_probability": result.get("false_onset_probability", 0),
            "dry_spell_probability": dry_spell_probability(result),
        }
        for index in range(seasons)
    ]


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
        "http://127.0.0.1:5173", "http://localhost:4000", "http://127.0.0.1:4000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

if supabase_router:
    app.include_router(supabase_router)

if grid_router:
    app.include_router(grid_router)

if ingest_router:
    app.include_router(ingest_router)

if analytics_router:
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

    boundary_path = candidates[0]
    return load_boundary_geojson(str(boundary_path), boundary_path.stat().st_mtime_ns)


@lru_cache(maxsize=16)
def load_boundary_geojson(boundary_path: str, _mtime_ns: int):
    with Path(boundary_path).open("r", encoding="utf-8") as boundary_file:
        return json.load(boundary_file)


@app.get("/api/results/summary")
def get_results_summary():
    results = load_results()

    risk_counts = Counter(result["overall_risk_level"] for result in results)
    average_false_onset_probability = round(
        sum(result["false_onset_probability"] for result in results) / len(results),
        3,
    )
    average_dry_spell_probability = round(
        sum(dry_spell_probability(result) for result in results) / len(results),
        3,
    )
    seasons_analyzed = max(result["seasons_analyzed"] for result in results)

    highest_risk_cells = sorted(
        results,
        key=lambda result: (
            dry_spell_probability(result),
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
        "average_dry_spell_probability": average_dry_spell_probability,
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
def get_pipeline_results(grid_id: str | None = Query(default=None), limit: int = Query(default=1000, ge=1, le=20000)):
    results = normalize_results(load_results())
    if grid_id:
        results = [result for result in results if result.get("grid_id") == grid_id]
    return {"count": len(results[:limit]), "data": results[:limit]}


@app.get("/api/grid/cells/{grid_id}/history")
def get_grid_history(grid_id: str):
    results = normalize_results(load_results())
    result = next((row for row in results if str(row.get("grid_id")) == str(grid_id)), None)
    if not result:
        return {"grid_id": grid_id, "season_count": 0, "seasons": []}

    diagnostics = build_season_diagnostics_from_result(result)

    return {"grid_id": grid_id, "season_count": len(diagnostics), "seasons": diagnostics}


@app.get("/api/seasons/years")
def get_available_season_years():
    years = extract_available_years(load_results())
    ranges = []
    if years:
        ranges.append({"label": "All Seasons", "value": "all", "start_year": years[0], "end_year": years[-1]})
        decade_start = (years[0] // 10) * 10
        while decade_start <= years[-1]:
            start = max(decade_start, years[0])
            end = min(decade_start + 9, years[-1])
            if any(start <= year <= end for year in years):
                ranges.append({"label": f"{start}-{end}", "value": f"{start}-{end}", "start_year": start, "end_year": end})
            decade_start += 10

    return {"year_count": len(years), "available_years": years, "ranges": ranges}


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
    try:
        grid_cell_count = len(load_results())
    except Exception:
        grid_cell_count = 0

    return {
        "status": "ok" if grid_cell_count else "offline",
        "grid_cell_count": grid_cell_count,
        "source": "local-results" if grid_cell_count else None,
    }


@app.get("/api/locations/hierarchy")
def get_location_hierarchy():
    """Return District → TA hierarchy tree for the location selector."""
    ta_summaries = build_ta_summaries()

    # Group TAs by district
    district_map: dict[str, dict[str, dict]] = {}
    for ta in ta_summaries:
        district = ta.get("district") or "Unknown"
        if district not in district_map:
            district_map[district] = {}

        ta_name = ta["traditional_authority"]
        existing = district_map[district].get(ta_name)
        if existing:
            existing["grid_cell_count"] += ta["grid_cell_count"]
            existing["average_false_onset_probability"] = max(
                existing["average_false_onset_probability"],
                ta["average_false_onset_probability"],
            )
            existing["average_dry_spell_probability"] = max(
                existing["average_dry_spell_probability"],
                ta["average_dry_spell_probability"],
            )
            if ta["overall_risk_level"] == "High" or existing["overall_risk_level"] == "High":
                existing["overall_risk_level"] = "High"
            elif ta["overall_risk_level"] == "Medium" or existing["overall_risk_level"] == "Medium":
                existing["overall_risk_level"] = "Medium"
        else:
            district_map[district][ta_name] = {
                "ta": ta_name,
                "grid_cell_count": ta["grid_cell_count"],
                "overall_risk_level": ta["overall_risk_level"],
                "average_false_onset_probability": ta["average_false_onset_probability"],
                "average_dry_spell_probability": ta["average_dry_spell_probability"],
            }

    hierarchy = sorted(
        [
            {
                "district": dist,
                "ta_count": len(tas),
                "traditional_authorities": sorted(tas.values(), key=lambda x: x["ta"]),
            }
            for dist, tas in district_map.items()
            if dist != "Unknown"
        ],
        key=lambda x: x["district"],
    )

    return {"district_count": len(hierarchy), "districts": hierarchy}


@app.get("/api/locations/search")
def search_locations(name: str = Query(...), limit: int = Query(default=10)):
    name_lower = name.lower()
    results = []

    # Search districts
    district_summaries = build_district_summaries()
    for d in district_summaries:
        if name_lower in d["district"].lower():
            results.append({
                "location_name": d["district"],
                "district": d["district"],
                "traditional_authority": None,
                "grid_id": None,
                "longitude": 0.0,
                "latitude": 0.0,
                "place_type": "District",
                "population": None,
            })

    # Search TAs
    ta_summaries = build_ta_summaries()
    for ta in ta_summaries:
        ta_name = ta.get("traditional_authority", "")
        if name_lower in ta_name.lower():
            results.append({
                "location_name": f"{ta_name} (TA)",
                "district": ta.get("district"),
                "traditional_authority": ta_name,
                "grid_id": None,
                "longitude": 0.0,
                "latitude": 0.0,
                "place_type": "Traditional Authority",
                "population": None,
            })

    existing_location_names = {str(result["location_name"]).lower() for result in results}
    for place in search_places(name, limit):
        location_name = place["name"]
        if location_name.lower() in existing_location_names:
            location_name = f"{location_name} ({place['place_type']})"
        results.append({
            "location_name": location_name,
            "district": None,
            "traditional_authority": None,
            "grid_id": None,
            "longitude": place["longitude"],
            "latitude": place["latitude"],
            "place_type": place["place_type"],
            "population": place["population"],
        })
        existing_location_names.add(location_name.lower())

    # Search grids
    # Try to find grids where grid_id == name or grid_code contains name
    try:
        all_grids = load_results()
        for g in all_grids:
            grid_id_str = str(g.get("grid_id", ""))
            grid_code_str = str(g.get("grid_code", ""))
            if name_lower in grid_id_str.lower() or name_lower in grid_code_str.lower():
                results.append({
                    "location_name": f"Grid {grid_id_str}",
                    "district": g.get("district_name") or g.get("district"),
                    "traditional_authority": None,
                    "grid_id": grid_id_str,
                    "longitude": float(g.get("centroid_lon", g.get("longitude", 0.0))),
                    "latitude": float(g.get("centroid_lat", g.get("latitude", 0.0))),
                    "place_type": "Grid Cell",
                    "population": None,
                })
                if len(results) > limit * 3:
                    break
    except Exception:
        pass

    # Sort results to have exact matches first, then by name
    results.sort(key=lambda x: (
        0 if x["location_name"].lower().startswith(name_lower) else 1,
        x["location_name"]
    ))

    # Remove duplicates
    seen = set()
    unique_results = []
    for r in results:
        key = (r["location_name"], r["district"], r["grid_id"])
        if key not in seen:
            seen.add(key)
            unique_results.append(r)

    return {
        "query": name,
        "match_count": len(unique_results[:limit]),
        "locations": unique_results[:limit]
    }


@app.get("/api/locations/ta-results")
def get_ta_results(district: str = Query(...), ta: str = Query(...)):
    """Return aggregated climate risk data for a specific Traditional Authority."""
    ta_summaries = build_ta_summaries()

    matched = next(
        (
            s for s in ta_summaries
            if s["traditional_authority"].lower() == ta.lower()
            and (s.get("district") or "").lower() == district.lower()
        ),
        None,
    )

    if not matched:
        # Try fuzzy match on TA name only
        matched = next(
            (s for s in ta_summaries if s["traditional_authority"].lower() == ta.lower()),
            None,
        )

    if not matched:
        raise HTTPException(status_code=404, detail=f"TA '{ta}' not found in district '{district}'.")

    return matched


@app.get("/api/locations/district-results")
def get_district_results(district: str = Query(...)):
    """Return aggregated climate risk data for a specific district."""
    district_summaries = build_district_summaries()
    matched = next(
        (d for d in district_summaries if d["district"].lower() == district.lower()),
        None,
    )
    if not matched:
        raise HTTPException(status_code=404, detail=f"District '{district}' not found.")
    return matched


@app.get("/api/locations/ta-grids")
def get_ta_grids(district: str = Query(None), ta: str = Query(...)):
    """Return individual grid cell risk data for a specific Traditional Authority."""
    grids = get_grids_for_ta(ta, district)
    
    if not grids:
        raise HTTPException(status_code=404, detail=f"No grids found for TA '{ta}'")
        
    return {
        "grid_count": len(grids),
        "traditional_authority": ta,
        "district": district,
        "grids": grids
    }


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

    return _load_results_cached(RESULTS_JSON_PATH.stat().st_mtime_ns)


@lru_cache(maxsize=2)
def _load_results_cached(_results_mtime_ns: int):
    with RESULTS_JSON_PATH.open("r", encoding="utf-8") as results_file:
        return normalize_results(json.load(results_file))


def normalize_results(results: list[dict]) -> list[dict]:
    normalized = []
    for result in results:
        row = dict(result)
        if "dry_spell_probability" not in row:
            row["dry_spell_probability"] = row.get(LEGACY_DRY_PROBABILITY_KEY, 0.0)
        if "dry_spell_interpretation" not in row:
            row["dry_spell_interpretation"] = row.get(LEGACY_DRY_INTERPRETATION_KEY)
        row.pop(LEGACY_DRY_PROBABILITY_KEY, None)
        row.pop(LEGACY_DRY_INTERPRETATION_KEY, None)
        normalized.append(row)
    return normalized
