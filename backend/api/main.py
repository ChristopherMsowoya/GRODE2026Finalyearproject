from pathlib import Path
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import uuid
from urllib.error import URLError
from urllib.request import Request, urlopen
from collections import Counter
import csv
from datetime import datetime, timezone, timedelta
from functools import lru_cache
import math
import numpy as np
import pandas as pd

from fastapi import Depends, FastAPI, HTTPException, Query, Request as FastAPIRequest
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
RAW_CHIRPS_DIR = PROJECT_ROOT / "backend" / "algorithms" / "data" / "raw"
SHAPEFILES_ROOT = PROJECT_ROOT / "backend" / "database" / "data" / "shapefiles"
ALLOWED_RAINFALL_DATASET_EXTENSIONS = {".nc", ".nc4", ".cdf"}
ADMIN_ACCESS_CODE = os.environ.get("GRODE_ADMIN_ACCESS_CODE") or os.environ.get("ADMIN_ACCESS_CODE") or "grode-admin-2026"
ADMIN_SESSION_SECRET = os.environ.get("GRODE_ADMIN_SESSION_SECRET") or os.environ.get("SUPABASE_KEY") or ADMIN_ACCESS_CODE
ADMIN_SESSION_TTL_SECONDS = int(os.environ.get("GRODE_ADMIN_SESSION_TTL_SECONDS", "28800"))
DEFAULT_FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://grode-frontend.onrender.com",
]
FRONTEND_ORIGINS = sorted({
    origin.strip().rstrip("/")
    for origin in (
        DEFAULT_FRONTEND_ORIGINS
        + (os.environ.get("FRONTEND_ORIGINS") or os.environ.get("CORS_ORIGINS") or "").split(",")
    )
    if origin.strip()
})

if str(ALGORITHMS_SRC) not in sys.path:
    sys.path.append(str(ALGORITHMS_SRC))

from backend.src.pipeline.run_pipeline import run
from config.algorithm_config import DEFAULT_ALGORITHM_CONFIG, load_algorithm_config, save_algorithm_config


LEGACY_DRY_PROBABILITY_KEY = "crop_" + "stress_probability"
LEGACY_DRY_INTERPRETATION_KEY = "crop_" + "stress_interpretation"
EA_SHAPEFILE_PATH = SHAPEFILES_ROOT / "enum" / "ECHO2_prioritization.shp"
GEONAMES_MW_PATH = PROJECT_ROOT / "backend" / "database" / "data" / "location_sources" / "MW" / "MW.txt"
USE_LOCAL_LOCATION_API = os.environ.get("GRID_API_SOURCE", "local").lower() in {"local", "file", "files"}
ENABLE_GOOGLE_PLACES = os.environ.get("ENABLE_GOOGLE_PLACES", "").lower() in {"1", "true", "yes"}
GOOGLE_MAPS_API_KEY = (os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_API_KEY")) if ENABLE_GOOGLE_PLACES else None

# The HOTOSM populated-places file misses some well-known urban neighbourhood
# names, especially Lilongwe "Area XX" names. Keep this tiny supplement local
# so the demo does not depend on Google Places.
CURATED_LOCATION_AREAS = [
    {"name": "Area 18", "district": "Lilongwe", "longitude": 33.7790, "latitude": -13.9600, "place_type": "urban area"},
    {"name": "Area 23", "district": "Lilongwe", "longitude": 33.7760, "latitude": -13.9550, "place_type": "urban area"},
    {"name": "Area 24", "district": "Lilongwe", "longitude": 33.7870, "latitude": -13.9440, "place_type": "urban area"},
    {"name": "Area 25", "district": "Lilongwe", "longitude": 33.7710, "latitude": -13.8730, "place_type": "urban area"},
    {"name": "Area 36", "district": "Lilongwe", "longitude": 33.8010, "latitude": -13.9950, "place_type": "urban area"},
    {"name": "Area 43", "district": "Lilongwe", "longitude": 33.7540, "latitude": -13.9620, "place_type": "urban area"},
    {"name": "Area 47", "district": "Lilongwe", "longitude": 33.7460, "latitude": -13.9900, "place_type": "urban area"},
    {"name": "Area 49", "district": "Lilongwe", "longitude": 33.7350, "latitude": -13.9760, "place_type": "urban area"},
    {"name": "Area 50", "district": "Lilongwe", "longitude": 33.7420, "latitude": -13.9530, "place_type": "urban area"},
    {"name": "Area 51", "district": "Lilongwe", "longitude": 33.7620, "latitude": -13.9290, "place_type": "urban area"},
    {"name": "Area 52", "district": "Lilongwe", "longitude": 33.7810, "latitude": -13.9250, "place_type": "urban area"},
    {"name": "Area 53", "district": "Lilongwe", "longitude": 33.7070, "latitude": -13.9300, "place_type": "urban area"},
    {"name": "Area 58", "district": "Lilongwe", "longitude": 33.7240, "latitude": -13.9050, "place_type": "urban area"},
]


def dry_spell_probability(result: dict) -> float:
    return result.get("dry_spell_probability", result.get(LEGACY_DRY_PROBABILITY_KEY, 0.0))


def dry_spell_probability_for_threshold(result: dict, threshold: int) -> float:
    if threshold == 5:
        return float(result.get("dry_spell_probability_5day", dry_spell_probability(result)) or 0)
    return float(result.get(f"dry_spell_probability_{threshold}day") or 0)


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
            "dry_spell_probability_5day": dry_spell_probability_for_threshold(result, 5),
            "dry_spell_probability_7day": dry_spell_probability_for_threshold(result, 7),
            "dry_spell_probability_9day": dry_spell_probability_for_threshold(result, 9),
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
    config = load_algorithm_config()
    rainy_months = set(range(config["season_start_month"], 13)) | set(range(1, config["season_end_month"] + 1))
    valid = []
    offsets = []
    for diagnostic in diagnostics:
        if not (diagnostic.get("onset_detected") and diagnostic.get("onset_date") and diagnostic.get("season_year") is not None):
            continue
        try:
            onset_date = datetime.fromisoformat(str(diagnostic["onset_date"])).date()
            season_year = int(diagnostic["season_year"])
            if onset_date.month not in rainy_months:
                continue
            season_start = datetime(season_year, config["season_start_month"], 1).date()
            if onset_date.month <= config["season_end_month"] and onset_date.year == season_year:
                continue
            if onset_date.month >= config["season_start_month"] and onset_date.year != season_year:
                continue
            offsets.append((onset_date - season_start).days)
            valid.append(diagnostic)
        except Exception:
            continue

    if not offsets:
        return {
            "p10_onset_date": None,
            "median_onset_date": None,
            "p90_onset_date": None,
            "onset_spread_days": None,
            "onset_variability_std": None,
            "trigger_count": 0,
            "series": [],
        }

    median_year = int(valid[len(valid) // 2]["season_year"])
    season_start = datetime(median_year, config["season_start_month"], 1).date()

    def date_at(pct: float):
        value = percentile(offsets, pct)
        if value is None:
            return None
        return (season_start + timedelta(days=round(value))).isoformat()

    return {
        "p10_onset_date": date_at(0.10),
        "median_onset_date": date_at(0.50),
        "p90_onset_date": date_at(0.90),
        "onset_spread_days": round(percentile(offsets, 0.90) - percentile(offsets, 0.10)) if len(offsets) else None,
        "onset_variability_std": round(float(np.std(offsets)), 2) if len(offsets) else None,
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


@lru_cache(maxsize=1)
def load_raw_chirps_dataset():
    try:
        from ingestion.chirps_loader import load_chirps
        from processing.grid_extractor import DEFAULT_BOUNDS
    except Exception:
        return None

    if not RAW_CHIRPS_DIR.exists():
        return None

    try:
        return load_chirps(RAW_CHIRPS_DIR, bounds=DEFAULT_BOUNDS["malawi"])
    except Exception:
        return None


def season_year_for_date(date: pd.Timestamp, start_month: int = 11, end_month: int = 4) -> int | None:
    if date.month >= start_month:
        return int(date.year)
    if date.month <= end_month:
        return int(date.year - 1)
    return None


def onset_candidate_events_for_grid(grid_id: str, start_year: int | None, end_year: int | None) -> dict:
    config = load_algorithm_config()
    results = normalize_results(load_results())
    result = next((row for row in results if str(row.get("grid_id")) == str(grid_id)), None)
    if not result:
        raise HTTPException(status_code=404, detail=f"Grid cell {grid_id} not found.")

    ds = load_raw_chirps_dataset()
    if ds is None:
        return {"events": [], "season_count": 0}

    lat = float(result.get("latitude") or result.get("centroid_lat") or 0)
    lon = float(result.get("longitude") or result.get("centroid_lon") or 0)
    cell = ds["precip"].sel(lat=lat, lon=lon, method="nearest")
    dates = pd.to_datetime(cell["time"].values)
    rain = np.asarray(cell.values, dtype=float)
    frame = pd.DataFrame({"date": dates, "rain": rain})
    rainy_months = list(range(config["season_start_month"], 13)) + list(range(1, config["season_end_month"] + 1))
    frame = frame[frame["date"].dt.month.isin(rainy_months)].copy()
    frame["season_year"] = frame["date"].apply(
        lambda value: season_year_for_date(value, config["season_start_month"], config["season_end_month"])
    )
    frame = frame.dropna(subset=["season_year"])
    frame["season_year"] = frame["season_year"].astype(int)
    if start_year is not None:
        frame = frame[frame["season_year"] >= start_year]
    if end_year is not None:
        frame = frame[frame["season_year"] <= end_year]
    enabled_years = set(config.get("enabled_season_years") or [])
    if enabled_years:
        frame = frame[frame["season_year"].isin(enabled_years)]

    accepted_by_season = {
        int(item["season_year"]): str(item.get("onset_date"))
        for item in build_season_diagnostics_from_result(result)
        if item.get("onset_detected") and item.get("onset_date") and item.get("season_year") is not None
    }

    events = []
    for season_year, group in frame.groupby("season_year"):
        group = group.sort_values("date")
        season_rain = group["rain"].to_numpy(dtype=float)
        season_dates = group["date"].to_list()
        trigger_window = config["onset_trigger_window_days"]
        persistence_window = config["persistence_window_days"]
        if season_rain.size < max(trigger_window, persistence_window):
            continue
        rolling_sum = np.convolve(season_rain, np.ones(trigger_window, dtype=float), mode="valid")
        candidate_indices = np.where(rolling_sum >= config["onset_trigger_mm"])[0] + (trigger_window - 1)
        accepted_date = accepted_by_season.get(int(season_year))
        for index in candidate_indices:
            next_window = season_rain[index:index + persistence_window]
            if next_window.size < persistence_window:
                continue
            dry_spells = []
            current_spell = 0
            for value in next_window:
                if float(value) < config["dry_day_threshold_mm"]:
                    current_spell += 1
                elif current_spell:
                    dry_spells.append(current_spell)
                    current_spell = 0
            if current_spell:
                dry_spells.append(current_spell)
            if any(spell >= config["persistence_dry_spell_days"] for spell in dry_spells):
                continue
            date = pd.Timestamp(season_dates[index])
            season_start = datetime(int(season_year), config["season_start_month"], 1).date()
            events.append({
                "season": f"{int(season_year)}-{str(int(season_year) + 1)[-2:]}",
                "season_year": int(season_year),
                "flag_date": date.isoformat(),
                "day_offset": (date.date() - season_start).days,
                "rainfall_3day_total": round(float(rolling_sum[index - (trigger_window - 1)]), 2),
                "accepted_onset": bool(accepted_date and date.date().isoformat() in accepted_date),
            })

    return {"events": events, "season_count": len({event["season_year"] for event in events})}


def nearest_grid(lon: float, lat: float, results: list[dict]) -> dict | None:
    return min(
        results,
        key=lambda row: math.pow(float(row.get("longitude") or row.get("centroid_lon") or 0) - lon, 2)
        + math.pow(float(row.get("latitude") or row.get("centroid_lat") or 0) - lat, 2),
        default=None,
    )


def clean_code(value: object) -> str:
    text = str(value or "").strip()
    try:
        number = float(text)
        if number.is_integer():
            return str(int(number))
    except ValueError:
        pass
    if text.endswith(".00000"):
        return text[:-6]
    return text


@lru_cache(maxsize=1)
def load_local_enumeration_areas() -> list[dict]:
    try:
        import shapefile
    except Exception:
        return []

    if not EA_SHAPEFILE_PATH.exists():
        return []

    reader = shapefile.Reader(str(EA_SHAPEFILE_PATH))
    areas = []
    for index, shape_record in enumerate(reader.iterShapeRecords()):
        props = shape_record.record.as_dict()
        bbox = shape_record.shape.bbox if shape_record.shape.bbox else [0, 0, 0, 0]
        lon = (float(bbox[0]) + float(bbox[2])) / 2
        lat = (float(bbox[1]) + float(bbox[3])) / 2
        ea_id = clean_code(props.get("EACODE") or props.get("id") or f"ea-{index + 1}")
        district = str(props.get("DISTRICT") or props.get("district") or "Unknown").strip()
        ta = str(props.get("TA") or props.get("TA3_name") or "").strip()
        areas.append({
            "id": ea_id,
            "ea_name": f"EA {ea_id}",
            "ta_name": ta or None,
            "district_name": district,
            "longitude": lon,
            "latitude": lat,
        })

    return areas


def local_enumeration_districts() -> list[dict]:
    counts = Counter(area["district_name"] for area in load_local_enumeration_areas() if area.get("district_name"))
    valid_districts = {
        row["district"].lower()
        for row in build_district_summaries()
        if row.get("district") and row["district"] != "Unknown"
    }
    return [
        {"district": district, "enumeration_area_count": count}
        for district, count in sorted(counts.items())
        if district != "Unknown" and district.lower() in valid_districts
    ]


def local_enumeration_areas_for_district(district: str) -> list[dict]:
    district_lower = district.lower()
    areas = [
        area for area in load_local_enumeration_areas()
        if area.get("district_name", "").lower() == district_lower
    ]
    results = normalize_results(load_results())
    district_results = [
        row for row in results
        if (row.get("district_name") or row.get("district") or "").lower() == district_lower
    ] or results

    rows = []
    for area in areas:
        diagnostic = nearest_grid(float(area["longitude"]), float(area["latitude"]), district_results)
        rows.append({
            "id": area["id"],
            "ea_name": area["ea_name"],
            "ta_name": area["ta_name"],
            "district_name": area["district_name"],
            "area_latitude": area["latitude"],
            "area_longitude": area["longitude"],
            "grid_id": str(diagnostic.get("grid_id")) if diagnostic else None,
            "overlap_fraction": None,
            "contains_centroid": None,
            "intersecting_grid_count": 1 if diagnostic else 0,
            "grid": diagnostic,
        })

    return sorted(rows, key=lambda row: row["ea_name"])


def district_feature_for_name(district: str) -> dict | None:
    district_lower = district.lower()
    try:
        for feature in load_geojson_features(str(DISTRICTS_GEOJSON_PATH)):
            props = feature.get("properties") or {}
            name = props.get("DISTRICT") or props.get("shapeName") or props.get("name") or ""
            if str(name).lower() == district_lower:
                return feature
    except Exception:
        return None
    return None


@lru_cache(maxsize=1)
def load_geonames_location_areas() -> list[dict]:
    if not GEONAMES_MW_PATH.exists():
        return []

    rows: list[dict] = []
    try:
        with GEONAMES_MW_PATH.open("r", encoding="utf-8") as geonames_file:
            for row in csv.reader(geonames_file, delimiter="\t"):
                if len(row) < 19:
                    continue
                feature_class = row[6]
                if feature_class != "P":
                    continue
                name = row[1].strip()
                if len(name) < 2:
                    continue
                try:
                    latitude = float(row[4])
                    longitude = float(row[5])
                    population = int(row[14] or 0)
                except ValueError:
                    continue

                rows.append({
                    "name": name,
                    "place_type": row[7] or "populated place",
                    "population": population or None,
                    "longitude": longitude,
                    "latitude": latitude,
                    "source": "geonames",
                    "geoname_id": row[0],
                })
    except OSError:
        return []

    return rows


@lru_cache(maxsize=1)
def local_location_area_catalog() -> list[dict]:
    district_features = load_geojson_features(str(DISTRICTS_GEOJSON_PATH))
    rows: list[dict] = []
    seen = set()

    candidates = [
        {
            "name": place["name"],
            "place_type": place.get("place_type") or "place",
            "population": place.get("population"),
            "longitude": float(place["longitude"]),
            "latitude": float(place["latitude"]),
            "source": "local-place",
        }
        for place in search_places("", 10000)
    ]
    candidates.extend(load_geonames_location_areas())
    candidates.extend(
        {
            "name": area["name"],
            "place_type": area["place_type"],
            "population": None,
            "longitude": area["longitude"],
            "latitude": area["latitude"],
            "district_hint": area["district"],
            "source": "local-curated-area",
        }
        for area in CURATED_LOCATION_AREAS
    )

    for candidate in candidates:
        name = str(candidate.get("name") or "").strip()
        if len(name) < 2:
            continue

        lon = float(candidate["longitude"])
        lat = float(candidate["latitude"])
        district_hint = str(candidate.get("district_hint") or "").lower()

        matched_district = None
        for feature in district_features:
            props = feature.get("properties") or {}
            district_name = props.get("DISTRICT") or props.get("shapeName") or props.get("name")
            if district_hint and str(district_name).lower() != district_hint:
                continue
            if bbox_contains(feature["_bbox"], lon, lat) and point_in_geometry(lon, lat, feature["geometry"]):
                matched_district = str(district_name)
                break

        if not matched_district:
            continue

        key = (matched_district.lower(), name.lower(), round(lat, 5), round(lon, 5))
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            **candidate,
            "name": name,
            "district": matched_district,
        })

    return sorted(rows, key=lambda row: (row["district"], row["name"]))


def local_location_area_districts() -> list[dict]:
    counts = Counter(row["district"] for row in local_location_area_catalog())
    return [
        {
            "district": district["district"],
            "enumeration_area_count": counts.get(district["district"], 0),
        }
        for district in build_district_summaries()
        if district.get("district") and district["district"] != "Unknown"
    ]


def location_grid_payload(name: str, district: str, lon: float, lat: float, source: str, place_type: str = "place") -> dict | None:
    district_lower = district.lower()
    results = normalize_results(load_results())
    district_results = [
        row for row in results
        if (row.get("district_name") or row.get("district") or "").lower() == district_lower
    ] or results
    diagnostic = nearest_grid(lon, lat, district_results)
    if not diagnostic:
        return None

    return {
        "id": f"{source}:{district}:{name}:{round(lat, 6)}:{round(lon, 6)}",
        "ea_name": name,
        "display_name": name,
        "ta_name": name,
        "district_name": district,
        "area_latitude": lat,
        "area_longitude": lon,
        "place_type": place_type,
        "source": source,
        "grid_id": str(diagnostic.get("grid_id")),
        "overlap_fraction": None,
        "contains_centroid": None,
        "intersecting_grid_count": 1,
        "grid": diagnostic,
    }


def local_area_search(district: str, q: str, limit: int) -> list[dict]:
    query = q.lower()
    rows: list[dict] = []
    seen = set()

    local_candidates = [
        area for area in local_location_area_catalog()
        if area["district"].lower() == district.lower()
        and (
            query in area["name"].lower()
            or query in str(area.get("place_type") or "").lower()
        )
    ]

    for place in sorted(local_candidates, key=lambda row: (0 if row["name"].lower().startswith(query) else 1, row["name"])):
        lon = float(place["longitude"])
        lat = float(place["latitude"])
        name = str(place["name"]).strip()
        if not name or name.lower() in seen:
            continue
        payload = location_grid_payload(name, district, lon, lat, place["source"], place.get("place_type") or "place")
        if payload:
            payload["population"] = place.get("population")
            rows.append(payload)
            seen.add(name.lower())
        if len(rows) >= limit:
            break

    return rows


def google_places_area_search(district: str, q: str, limit: int) -> list[dict]:
    if not GOOGLE_MAPS_API_KEY:
        return []

    district_feature = district_feature_for_name(district)
    body: dict = {
        "textQuery": f"{q}, {district} District, Malawi",
        "regionCode": "MW",
        "maxResultCount": min(max(limit, 1), 10),
    }
    if district_feature:
        min_lon, min_lat, max_lon, max_lat = district_feature["_bbox"]
        body["locationBias"] = {
            "rectangle": {
                "low": {"latitude": min_lat, "longitude": min_lon},
                "high": {"latitude": max_lat, "longitude": max_lon},
            }
        }

    request = Request(
        "https://places.googleapis.com/v1/places:searchText",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.types",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=6) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, json.JSONDecodeError):
        return []

    rows = []
    seen = set()
    for place in payload.get("places", []):
        location = place.get("location") or {}
        lat = location.get("latitude")
        lon = location.get("longitude")
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            continue
        if district_feature and not (
            bbox_contains(district_feature["_bbox"], float(lon), float(lat))
            and point_in_geometry(float(lon), float(lat), district_feature["geometry"])
        ):
            continue
        name = ((place.get("displayName") or {}).get("text") or place.get("formattedAddress") or q).strip()
        if not name or name.lower() in seen:
            continue
        payload_row = location_grid_payload(name, district, float(lon), float(lat), "google-places", "Google Places")
        if payload_row:
            payload_row["formatted_address"] = place.get("formattedAddress")
            payload_row["google_types"] = place.get("types") or []
            rows.append(payload_row)
            seen.add(name.lower())
        if len(rows) >= limit:
            break

    return rows


class PipelineRunRequest(BaseModel):
    region: str = "malawi"


class AlgorithmConfigRequest(BaseModel):
    season_start_month: int = 11
    season_end_month: int = 4
    enabled_season_years: list[int] = []
    onset_trigger_mm: float = 25.0
    onset_trigger_window_days: int = 3
    persistence_window_days: int = 20
    persistence_dry_spell_days: int = 10
    dry_day_threshold_mm: float = 1.0
    dry_spell_threshold_days: list[int] = [5, 7, 9]


class AdminSessionRequest(BaseModel):
    access_code: str


def base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def sign_admin_payload(payload: str) -> str:
    return hmac.new(ADMIN_SESSION_SECRET.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def create_admin_token() -> str:
    payload = {
        "scope": "admin",
        "exp": int(datetime.now(timezone.utc).timestamp()) + ADMIN_SESSION_TTL_SECONDS,
        "nonce": str(uuid.uuid4()),
    }
    encoded_payload = base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{encoded_payload}.{sign_admin_payload(encoded_payload)}"


def verify_admin_token(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    encoded_payload, signature = token.rsplit(".", 1)
    if not hmac.compare_digest(signature, sign_admin_payload(encoded_payload)):
        return False
    try:
        payload = json.loads(base64url_decode(encoded_payload))
    except Exception:
        return False
    return payload.get("scope") == "admin" and int(payload.get("exp") or 0) > int(datetime.now(timezone.utc).timestamp())


def require_admin_session(request: FastAPIRequest):
    token = request.headers.get("x-admin-token", "")
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not verify_admin_token(token):
        raise HTTPException(status_code=401, detail="Admin access required.")
    return True


def infer_season_year_from_filename(filename: str) -> int | None:
    match = re.search(r"(?:19|20)\d{2}", filename)
    if not match:
        return None
    return int(match.group(0))


def extract_raw_dataset_years() -> list[int]:
    if not RAW_CHIRPS_DIR.exists():
        return []

    years = set()
    for dataset_path in RAW_CHIRPS_DIR.iterdir():
        if not dataset_path.is_file():
            continue
        if dataset_path.suffix.lower() not in ALLOWED_RAINFALL_DATASET_EXTENSIONS:
            continue
        year = infer_season_year_from_filename(dataset_path.name)
        if year:
            years.add(year)
    return sorted(years)


def available_dataset_years(results: list[dict] | None = None) -> list[int]:
    raw_years = extract_raw_dataset_years()
    if raw_years:
        return raw_years
    if results is None:
        try:
            results = load_results()
        except Exception:
            results = []
    return extract_available_years(results)


def active_configured_years(config: dict, available_years: list[int]) -> list[int]:
    enabled_years = sorted({
        int(year)
        for year in config.get("enabled_season_years", [])
        if str(year).isdigit()
    })
    if not enabled_years:
        return available_years

    available = set(available_years)
    if not available:
        return enabled_years
    return [year for year in enabled_years if year in available]


app = FastAPI(
    title="GRODE Backend API",
    description="API for rainfall-risk pipeline execution and result retrieval.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
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


@app.post("/api/admin/session")
def create_admin_session(payload: AdminSessionRequest):
    if not hmac.compare_digest(payload.access_code.strip(), ADMIN_ACCESS_CODE):
        raise HTTPException(status_code=401, detail="Invalid admin access code.")
    return {
        "status": "authenticated",
        "token": create_admin_token(),
        "expires_in_seconds": ADMIN_SESSION_TTL_SECONDS,
    }


@app.get("/api/admin/session")
def get_admin_session(_: bool = Depends(require_admin_session)):
    return {"status": "authenticated"}


@app.get("/api/admin/algorithm-config")
def get_algorithm_config(_: bool = Depends(require_admin_session)):
    config = load_algorithm_config()
    available_years = available_dataset_years()
    return {
        "config": config,
        "defaults": DEFAULT_ALGORITHM_CONFIG,
        "available_years": available_years,
        "active_years": active_configured_years(config, available_years),
    }


@app.put("/api/admin/algorithm-config")
def update_algorithm_config(payload: AlgorithmConfigRequest, _: bool = Depends(require_admin_session)):
    saved = save_algorithm_config(payload.dict())
    _load_results_cached.cache_clear()
    load_raw_chirps_dataset.cache_clear()
    return {
        "status": "saved",
        "config": saved,
        "message": "Configuration saved. Rerun the rainfall pipeline for outputs to use the new settings.",
    }


@app.post("/api/admin/algorithm-config/upload-season")
async def upload_season_dataset(
    request: FastAPIRequest,
    filename: str = Query(..., min_length=1),
    season_year: int | None = Query(default=None),
    _: bool = Depends(require_admin_session),
):
    safe_filename = Path(filename).name
    if not safe_filename or safe_filename in {".", ".."}:
        raise HTTPException(status_code=400, detail="Provide a valid dataset filename.")

    extension = Path(safe_filename).suffix.lower()
    if extension not in ALLOWED_RAINFALL_DATASET_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_RAINFALL_DATASET_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported rainfall dataset type. Use one of: {allowed}.")

    RAW_CHIRPS_DIR.mkdir(parents=True, exist_ok=True)
    target_path = RAW_CHIRPS_DIR / safe_filename
    size_bytes = 0

    try:
        with target_path.open("wb") as output:
            async for chunk in request.stream():
                if not chunk:
                    continue
                size_bytes += len(chunk)
                output.write(chunk)
    except Exception as exc:
        if target_path.exists() and size_bytes == 0:
            target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Could not save rainfall dataset: {exc}") from exc

    if size_bytes == 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded rainfall dataset was empty.")

    resolved_year = season_year or infer_season_year_from_filename(safe_filename)
    config = load_algorithm_config()
    if resolved_year:
        active_years = set(config.get("enabled_season_years") or [])
        if not active_years:
            active_years.update(available_dataset_years())
        active_years.add(int(resolved_year))
        config["enabled_season_years"] = sorted(active_years)
        config = save_algorithm_config(config)

    _load_results_cached.cache_clear()
    load_raw_chirps_dataset.cache_clear()

    return {
        "status": "uploaded",
        "filename": safe_filename,
        "saved_to": str(target_path),
        "size_bytes": size_bytes,
        "season_year": resolved_year,
        "config": config,
        "message": (
            f"{safe_filename} was saved to backend/algorithms/data/raw"
            + (f" and registered as the {resolved_year}-{str(resolved_year + 1)[-2:]} season." if resolved_year else ".")
            + " The home dashboard season count will update from loaded datasets. Rerun the rainfall pipeline to generate updated maps and graph outputs."
        ),
    }


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
    years = available_dataset_years()
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
    config = load_algorithm_config()
    try:
        results = normalize_results(load_results())
    except HTTPException:
        results = []

    dataset_years = available_dataset_years(results)
    active_years = active_configured_years(config, dataset_years)

    if not results:
        return {
            "grid_count": 0,
            "season_count": len(active_years),
            "available_years": active_years,
            "average_onset_probability": 0,
            "average_false_onset_probability": 0,
            "average_dry_spell_probability": 0,
        }

    return {
        "grid_count": len(results),
        "season_count": len(active_years),
        "available_years": active_years,
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
            "dry_spell_probability_5day": dry_spell_probability_for_threshold(row, 5),
            "dry_spell_probability_7day": dry_spell_probability_for_threshold(row, 7),
            "dry_spell_probability_9day": dry_spell_probability_for_threshold(row, 9),
            "early_establishment_stress_probability": float(row.get("early_establishment_stress_probability", dry_spell_probability(row)) or 0),
            "onset_spread_days": row.get("onset_spread_days"),
            "onset_variability_std": row.get("onset_variability_std"),
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


@app.get("/api/onset/trigger-events")
def get_onset_trigger_events(
    grid_id: str = Query(...),
    start_year: int | None = Query(default=None),
    end_year: int | None = Query(default=None),
):
    payload = onset_candidate_events_for_grid(grid_id, start_year, end_year)
    return {
        "grid_id": grid_id,
        "start_year": start_year,
        "end_year": end_year,
        **payload,
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


@app.get("/api/locations/enumeration-area-hierarchy")
def get_enumeration_area_hierarchy():
    """Return District -> Enumeration Area hierarchy when EA geometries are loaded."""
    try:
        from backend.database.connection import fetch_all

        rows = fetch_all(
            """
            select
                ea.district_name,
                ea.id as enumeration_area_id,
                ea.ea_name as enumeration_area_name,
                count(eagi.grid_id) as grid_cell_count
            from enumeration_areas ea
            left join enumeration_area_grid_intersections eagi
                on eagi.enumeration_area_id = ea.id
            group by ea.district_name, ea.id, ea.ea_name
            order by ea.district_name, ea.ea_name
            """
        )
    except Exception:
        return {
            "available": False,
            "district_count": 0,
            "districts": [],
            "detail": "Enumeration-area geometry has not been loaded. Run backend/database/enumeration_area_grid_mapping.sql after importing real EA polygons.",
        }

    district_map: dict[str, list[dict]] = {}
    for row in rows:
        district_map.setdefault(row["district_name"], []).append({
            "enumeration_area_id": row["enumeration_area_id"],
            "enumeration_area_name": row["enumeration_area_name"],
            "grid_cell_count": row["grid_cell_count"],
        })

    return {
        "available": True,
        "district_count": len(district_map),
        "districts": [
            {
                "district": district,
                "enumeration_area_count": len(areas),
                "enumeration_areas": areas,
            }
            for district, areas in district_map.items()
        ],
    }


@app.get("/api/locations/districts")
def get_location_districts():
    """Return all districts for the location-area selector."""
    if USE_LOCAL_LOCATION_API:
        rows = local_location_area_districts()
        if rows:
            return {"available": True, "district_count": len(rows), "districts": rows, "source": "local-location-catalog"}
    else:
        try:
            from backend.database.connection import fetch_all

            rows = fetch_all(
                """
                select district_name as district, count(*) as enumeration_area_count
                from enumeration_areas
                group by district_name
                order by district_name
                """
            )
            if rows:
                return {"available": True, "district_count": len(rows), "districts": rows}
        except Exception:
            pass

    districts = [
        {"district": row["district"], "enumeration_area_count": 0}
        for row in build_district_summaries()
        if row.get("district") and row["district"] != "Unknown"
    ]
    return {
        "available": False,
        "district_count": len(districts),
        "districts": districts,
        "detail": "Enumeration areas are not loaded yet; district list is from grid coverage.",
    }


@app.get("/api/locations/enumeration-areas")
def get_enumeration_areas_by_district(district: str = Query(...)):
    """Return enumeration areas for a district, including their primary mapped grid."""
    if USE_LOCAL_LOCATION_API:
        areas = local_enumeration_areas_for_district(district)
        return {
            "available": bool(areas),
            "district": district,
            "enumeration_area_count": len(areas),
            "enumeration_areas": areas,
            "source": "local-shapefile",
        }
    else:
        try:
            from backend.database.connection import fetch_all

            rows = fetch_all(
                """
                select
                    ea.id,
                    ea.ea_name,
                    ea.ta_name,
                    ea.district_name,
                    ST_Y(ST_PointOnSurface(ea.geom)) as area_latitude,
                    ST_X(ST_PointOnSurface(ea.geom)) as area_longitude,
                    primary_grid.grid_id,
                    primary_grid.overlap_fraction,
                    primary_grid.contains_centroid,
                    count(eagi.grid_id) as intersecting_grid_count
                from enumeration_areas ea
                left join lateral (
                    select grid_id, overlap_fraction, contains_centroid
                    from enumeration_area_grid_intersections eagi2
                    where eagi2.enumeration_area_id = ea.id
                    order by contains_centroid desc, overlap_fraction desc
                    limit 1
                ) primary_grid on true
                left join enumeration_area_grid_intersections eagi
                    on eagi.enumeration_area_id = ea.id
                where lower(ea.district_name) = lower(%(district)s)
                group by ea.id, ea.ea_name, ea.ta_name, ea.district_name,
                         ea.geom,
                         primary_grid.grid_id, primary_grid.overlap_fraction, primary_grid.contains_centroid
                order by ea.ea_name
                """,
                {"district": district},
            )
        except Exception:
            return {
                "available": False,
                "district": district,
                "enumeration_area_count": 0,
                "enumeration_areas": [],
                "detail": "Enumeration-area geometry has not been loaded.",
            }

        results = normalize_results(load_results())
        by_grid = {str(row.get("grid_id")): row for row in results}
        areas = []
        for row in rows:
            diagnostic = by_grid.get(str(row.get("grid_id"))) if row.get("grid_id") else None
            areas.append({
                **row,
                "grid": diagnostic,
            })

        return {
            "available": True,
            "district": district,
            "enumeration_area_count": len(areas),
            "enumeration_areas": areas,
        }


@app.get("/api/locations/area-search")
def search_areas_in_district(
    district: str = Query(...),
    q: str = Query(..., min_length=2),
    limit: int = Query(default=10, ge=1, le=20),
):
    """Search named areas in a selected district, using Google Places when configured and local data as fallback."""
    google_rows = google_places_area_search(district, q, limit)
    local_rows = local_area_search(district, q, limit)

    rows = []
    seen = set()
    for row in [*google_rows, *local_rows]:
        key = (str(row.get("display_name") or row.get("ea_name") or "").lower(), row.get("grid_id"))
        if key in seen:
            continue
        seen.add(key)
        rows.append(row)
        if len(rows) >= limit:
            break

    return {
        "available": bool(rows),
        "district": district,
        "query": q,
        "google_enabled": bool(GOOGLE_MAPS_API_KEY),
        "source": "google-places+local" if google_rows else "local",
        "enumeration_area_count": len(rows),
        "enumeration_areas": rows,
    }


@app.get("/api/locations/enumeration-area-grids")
def get_enumeration_area_grids(enumeration_area_id: str = Query(...)):
    """Return grid diagnostics intersecting a real enumeration area."""
    try:
        from backend.database.connection import fetch_all

        rows = fetch_all(
            """
            select
                ea.id as enumeration_area_id,
                ea.ea_name as enumeration_area_name,
                ea.district_name as district,
                ea.ta_name,
                eagi.grid_id,
                eagi.overlap_area_km2,
                eagi.overlap_fraction,
                eagi.contains_centroid
            from enumeration_area_grid_intersections eagi
            join enumeration_areas ea
                on ea.id = eagi.enumeration_area_id
            where eagi.enumeration_area_id = %(enumeration_area_id)s
            order by eagi.contains_centroid desc, eagi.overlap_fraction desc
            """,
            {"enumeration_area_id": enumeration_area_id},
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Enumeration-area grid mapping is unavailable until real EA polygons are loaded and clipped to grid cells.",
        )

    if not rows:
        raise HTTPException(status_code=404, detail=f"Enumeration area '{enumeration_area_id}' was not found.")

    results = normalize_results(load_results())
    by_grid = {str(row.get("grid_id")): row for row in results}
    grids = []
    for row in rows:
        diagnostic = by_grid.get(str(row["grid_id"]))
        if diagnostic:
            grids.append({**row, **diagnostic})

    return {
        "enumeration_area_id": enumeration_area_id,
        "grid_count": len(grids),
        "grids": grids,
    }


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
            "dry_spell_probability_5day": dry_spell_probability_for_threshold(grid, 5),
            "dry_spell_probability_7day": dry_spell_probability_for_threshold(grid, 7),
            "dry_spell_probability_9day": dry_spell_probability_for_threshold(grid, 9),
            "early_establishment_stress_probability": float(grid.get("early_establishment_stress_probability", dry_spell_probability(grid)) or 0),
            "onset_spread_days": grid.get("onset_spread_days"),
            "onset_variability_std": grid.get("onset_variability_std"),
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
        row.setdefault("dry_spell_probability_5day", row.get("dry_spell_probability", 0.0))
        row.setdefault("dry_spell_probability_7day", 0.0)
        row.setdefault("dry_spell_probability_9day", 0.0)
        row.setdefault("early_establishment_stress_probability", row.get("dry_spell_probability", 0.0))
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
