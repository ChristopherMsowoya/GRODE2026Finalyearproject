from pathlib import Path
import json
import os
import sys
import uuid
from collections import Counter
from datetime import datetime, timezone, timedelta
from functools import lru_cache
import math

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.api.spatial import (
    DISTRICTS_GEOJSON_PATH,
    bbox_contains,
    build_district_summaries,
    build_ta_summaries,
    get_grids_for_ta,
    load_geojson_features,
    point_in_geometry,
    search_places,
)

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


def probability_for_onset(result: dict) -> float:
    if isinstance(result.get("onset_probability"), (int, float)):
        return float(result["onset_probability"])
    seasons = result.get("seasons_analyzed") or 0
    detected = result.get("seasons_with_detected_onset") or 0
    return float(detected / seasons) if seasons else 0.0


def filter_diagnostics_by_range(diagnostics: list[dict], start_year: int | None, end_year: int | None) -> list[dict]:
    if start_year is None and end_year is None:
        return diagnostics
    filtered = []
    for diagnostic in diagnostics:
        year = diagnostic.get("season_year")
        if isinstance(year, str) and year.isdigit():
            year = int(year)
        if not isinstance(year, int):
            continue
        if start_year is not None and year < start_year:
            continue
        if end_year is not None and year > end_year:
            continue
        filtered.append(diagnostic)
    return filtered


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    sorted_values = sorted(values)
    rank = (len(sorted_values) - 1) * pct
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return sorted_values[lower]
    weight = rank - lower
    return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


def onset_timeline_from_diagnostics(diagnostics: list[dict]) -> dict:
    valid = [
        diagnostic
        for diagnostic in diagnostics
        if diagnostic.get("onset_detected") and diagnostic.get("onset_date") and diagnostic.get("season_year") is not None
    ]
    offsets = []
    for diagnostic in valid:
        try:
            onset_date = datetime.fromisoformat(str(diagnostic["onset_date"])).date()
            season_year = int(diagnostic["season_year"])
            season_start = datetime(season_year, 11, 1).date()
            offsets.append((onset_date - season_start).days)
        except Exception:
            continue

    if not offsets:
        return {
            "p10_onset_date": None,
            "median_onset_date": None,
            "p90_onset_date": None,
            "trigger_count": 0,
            "series": [],
        }

    median_year = int(valid[len(valid) // 2]["season_year"])
    season_start = datetime(median_year, 11, 1).date()

    def date_at(pct: float):
        value = percentile(offsets, pct)
        if value is None:
            return None
        return (season_start + timedelta(days=round(value))).isoformat()

    return {
        "p10_onset_date": date_at(0.10),
        "median_onset_date": date_at(0.50),
        "p90_onset_date": date_at(0.90),
        "trigger_count": len(offsets),
        "series": [
            {
                "season": diagnostic.get("season"),
                "season_year": diagnostic.get("season_year"),
                "onset_date": diagnostic.get("onset_date"),
                "onset_probability": diagnostic.get("onset_probability", 1.0),
            }
            for diagnostic in valid
        ],
    }


def nearest_grid(lon: float, lat: float, results: list[dict]) -> dict | None:
    return min(
        results,
        key=lambda row: math.pow(float(row.get("longitude") or row.get("centroid_lon") or 0) - lon, 2)
        + math.pow(float(row.get("latitude") or row.get("centroid_lat") or 0) - lat, 2),
        default=None,
    )


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


@app.get("/api/dashboard/overview")
def get_dashboard_overview():
    results = normalize_results(load_results())
    if not results:
        return {
            "grid_count": 0,
            "season_count": 0,
            "available_years": [],
            "average_onset_probability": 0,
            "average_false_onset_probability": 0,
            "average_dry_spell_probability": 0,
        }

    years = extract_available_years(results)
    return {
        "grid_count": len(results),
        "season_count": len(years),
        "available_years": years,
        "average_onset_probability": round(sum(probability_for_onset(result) for result in results) / len(results), 3),
        "average_false_onset_probability": round(sum(float(result.get("false_onset_probability") or 0) for result in results) / len(results), 3),
        "average_dry_spell_probability": round(sum(dry_spell_probability(result) for result in results) / len(results), 3),
    }


@app.get("/api/grid/search")
def search_grid_locations(q: str = Query(..., min_length=2), limit: int = Query(default=8, ge=1, le=20)):
    query = q.lower()
    results = normalize_results(load_results())
    matches = []

    def row_payload(row: dict, location_name: str, place_type: str, district: str | None = None, ta: str | None = None):
        return {
            "location_name": location_name,
            "district": district or row.get("district_name") or row.get("district"),
            "traditional_authority": ta,
            "grid_id": str(row.get("grid_id")),
            "longitude": float(row.get("longitude") or row.get("centroid_lon") or 0),
            "latitude": float(row.get("latitude") or row.get("centroid_lat") or 0),
            "place_type": place_type,
            "onset_probability": probability_for_onset(row),
            "false_onset_probability": float(row.get("false_onset_probability") or 0),
            "dry_spell_probability": dry_spell_probability(row),
            "seasons_analyzed": row.get("seasons_analyzed") or 0,
            "seasons_with_detected_onset": row.get("seasons_with_detected_onset") or 0,
            "first_detected_onset_date": row.get("first_detected_onset_date"),
            "latest_detected_onset_date": row.get("latest_detected_onset_date"),
            "overall_risk_level": row.get("overall_risk_level") or "Low",
        }

    for row in results:
        grid_id = str(row.get("grid_id", ""))
        grid_code = str(row.get("grid_code", ""))
        if query in grid_id.lower() or query in grid_code.lower():
            matches.append(row_payload(row, f"Grid {grid_id}", "Grid Cell"))

    for district in build_district_summaries():
        district_name = district.get("district", "")
        if query not in district_name.lower():
            continue
        district_grids = [
            row for row in results
            if (row.get("district_name") or row.get("district") or "").lower() == district_name.lower()
        ]
        candidate = district_grids[0] if district_grids else nearest_grid(34.2, -13.5, results)
        if candidate:
            matches.append(row_payload(candidate, district_name, "District", district=district_name))

    for ta in build_ta_summaries():
        ta_name = ta.get("traditional_authority", "")
        if query not in ta_name.lower():
            continue
        grids = get_grids_for_ta(ta_name, ta.get("district"))
        candidate = grids[0] if grids else None
        if candidate:
            matches.append(row_payload(candidate, f"{ta_name} (TA)", "Traditional Authority", district=ta.get("district"), ta=ta_name))

    for place in search_places(q, limit):
        candidate = nearest_grid(place["longitude"], place["latitude"], results)
        if candidate:
            matches.append(row_payload(candidate, place["name"], place["place_type"]))

    seen = set()
    unique = []
    for match in matches:
        key = (match["location_name"], match["grid_id"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(match)

    unique.sort(key=lambda item: (
        0 if item["location_name"].lower().startswith(query) else 1,
        item["location_name"],
    ))
    return {"query": q, "match_count": len(unique[:limit]), "locations": unique[:limit]}


@app.get("/api/onset/timeline")
def get_onset_timeline(
    grid_id: str = Query(...),
    start_year: int | None = Query(default=None),
    end_year: int | None = Query(default=None),
):
    results = normalize_results(load_results())
    result = next((row for row in results if str(row.get("grid_id")) == str(grid_id)), None)
    if not result:
        raise HTTPException(status_code=404, detail=f"Grid cell {grid_id} not found.")

    diagnostics = filter_diagnostics_by_range(build_season_diagnostics_from_result(result), start_year, end_year)
    timeline = onset_timeline_from_diagnostics(diagnostics)
    return {
        "grid_id": grid_id,
        "start_year": start_year,
        "end_year": end_year,
        **timeline,
    }


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
    grid_results = normalize_results(load_results())

    def nearest_grid_payload(lon: float, lat: float):
        grid = nearest_grid(lon, lat, grid_results)
        if not grid:
            return {}
        return {
            "grid_id": str(grid.get("grid_id")),
            "longitude": float(grid.get("longitude") or grid.get("centroid_lon") or lon),
            "latitude": float(grid.get("latitude") or grid.get("centroid_lat") or lat),
            "onset_probability": probability_for_onset(grid),
            "false_onset_probability": float(grid.get("false_onset_probability") or 0),
            "dry_spell_probability": dry_spell_probability(grid),
            "seasons_analyzed": grid.get("seasons_analyzed") or 0,
            "seasons_with_detected_onset": grid.get("seasons_with_detected_onset") or 0,
            "first_detected_onset_date": grid.get("first_detected_onset_date"),
            "latest_detected_onset_date": grid.get("latest_detected_onset_date"),
            "overall_risk_level": grid.get("overall_risk_level") or "Low",
            "district": grid.get("district_name") or grid.get("district"),
        }

    # Search districts
    district_summaries = build_district_summaries()
    for d in district_summaries:
        if name_lower in d["district"].lower():
            candidate = next(
                (
                    grid for grid in grid_results
                    if (grid.get("district_name") or grid.get("district") or "").lower() == d["district"].lower()
                ),
                None,
            )
            results.append({
                "location_name": d["district"],
                "district": d["district"],
                "traditional_authority": None,
                "grid_id": str(candidate.get("grid_id")) if candidate else None,
                "longitude": float(candidate.get("longitude") or candidate.get("centroid_lon") or 0.0) if candidate else 0.0,
                "latitude": float(candidate.get("latitude") or candidate.get("centroid_lat") or 0.0) if candidate else 0.0,
                "place_type": "District",
                "population": None,
                "onset_probability": probability_for_onset(candidate) if candidate else 0,
                "false_onset_probability": float(candidate.get("false_onset_probability") or 0) if candidate else 0,
                "dry_spell_probability": dry_spell_probability(candidate) if candidate else 0,
                "seasons_analyzed": candidate.get("seasons_analyzed") if candidate else 0,
                "seasons_with_detected_onset": candidate.get("seasons_with_detected_onset") if candidate else 0,
                "first_detected_onset_date": candidate.get("first_detected_onset_date") if candidate else None,
                "latest_detected_onset_date": candidate.get("latest_detected_onset_date") if candidate else None,
                "overall_risk_level": candidate.get("overall_risk_level") if candidate else "Low",
            })

    # Search TAs
    ta_summaries = build_ta_summaries()
    for ta in ta_summaries:
        ta_name = ta.get("traditional_authority", "")
        if name_lower in ta_name.lower():
            grids = get_grids_for_ta(ta_name, ta.get("district"))
            candidate = grids[0] if grids else None
            results.append({
                "location_name": f"{ta_name} (TA)",
                "district": ta.get("district"),
                "traditional_authority": ta_name,
                "grid_id": str(candidate.get("grid_id")) if candidate else None,
                "longitude": float(candidate.get("longitude") or candidate.get("centroid_lon") or 0.0) if candidate else 0.0,
                "latitude": float(candidate.get("latitude") or candidate.get("centroid_lat") or 0.0) if candidate else 0.0,
                "place_type": "Traditional Authority",
                "population": None,
                "onset_probability": probability_for_onset(candidate) if candidate else 0,
                "false_onset_probability": float(candidate.get("false_onset_probability") or 0) if candidate else 0,
                "dry_spell_probability": dry_spell_probability(candidate) if candidate else 0,
                "seasons_analyzed": candidate.get("seasons_analyzed") if candidate else 0,
                "seasons_with_detected_onset": candidate.get("seasons_with_detected_onset") if candidate else 0,
                "first_detected_onset_date": candidate.get("first_detected_onset_date") if candidate else None,
                "latest_detected_onset_date": candidate.get("latest_detected_onset_date") if candidate else None,
                "overall_risk_level": candidate.get("overall_risk_level") if candidate else "Low",
            })

    existing_location_names = {str(result["location_name"]).lower() for result in results}
    for place in search_places(name, limit):
        location_name = place["name"]
        if location_name.lower() in existing_location_names:
            location_name = f"{location_name} ({place['place_type']})"
        grid_payload = nearest_grid_payload(place["longitude"], place["latitude"])
        results.append({
            "location_name": location_name,
            "district": grid_payload.get("district"),
            "traditional_authority": None,
            "grid_id": grid_payload.get("grid_id"),
            "longitude": grid_payload.get("longitude", place["longitude"]),
            "latitude": grid_payload.get("latitude", place["latitude"]),
            "place_type": place["place_type"],
            "population": place["population"],
            **{key: value for key, value in grid_payload.items() if key not in {"district", "grid_id", "longitude", "latitude"}},
        })
        existing_location_names.add(location_name.lower())

    # Search grids
    # Try to find grids where grid_id == name or grid_code contains name
    try:
        for g in grid_results:
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
    try:
        districts = load_geojson_features(str(DISTRICTS_GEOJSON_PATH))
    except Exception:
        districts = []

    for result in results:
        row = dict(result)
        if "dry_spell_probability" not in row:
            row["dry_spell_probability"] = row.get(LEGACY_DRY_PROBABILITY_KEY, 0.0)
        if "dry_spell_interpretation" not in row:
            row["dry_spell_interpretation"] = row.get(LEGACY_DRY_INTERPRETATION_KEY)
        row.pop(LEGACY_DRY_PROBABILITY_KEY, None)
        row.pop(LEGACY_DRY_INTERPRETATION_KEY, None)

        if districts:
            lon = float(row.get("longitude") or row.get("centroid_lon") or 0)
            lat = float(row.get("latitude") or row.get("centroid_lat") or 0)
            matched_district = None
            for district in districts:
                if bbox_contains(district["_bbox"], lon, lat) and point_in_geometry(lon, lat, district["geometry"]):
                    matched_district = district["properties"].get("shapeName") or district["properties"].get("DISTRICT")
                    break
            if not matched_district:
                continue
            row["district_name"] = matched_district

        normalized.append(row)
    return normalized
