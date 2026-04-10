from __future__ import annotations

from functools import lru_cache
import json
from pathlib import Path
from datetime import datetime


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RESULTS_JSON_PATH = PROJECT_ROOT / "backend" / "algorithms" / "outputs" / "results.json"
DISTRICTS_GEOJSON_PATH = (
    PROJECT_ROOT
    / "backend"
    / "database"
    / "data"
    / "shapefiles"
    / "ADM2(district)"
    / "geoBoundaries-MWI-ADM2_simplified.geojson"
)
TA_GEOJSON_PATH = (
    PROJECT_ROOT
    / "backend"
    / "database"
    / "data"
    / "shapefiles"
    / "ADM3(TA)"
    / "geoBoundaries-MWI-ADM3_simplified.geojson"
)


@lru_cache(maxsize=None)
def load_geojson_features(path: str):
    with Path(path).open("r", encoding="utf-8") as geojson_file:
        data = json.load(geojson_file)

    return data["features"]


def load_algorithm_results():
    with RESULTS_JSON_PATH.open("r", encoding="utf-8") as results_file:
        return json.load(results_file)


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1

    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]

        intersects = ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )

        if intersects:
            inside = not inside

        j = i

    return inside


def point_in_polygon(lon: float, lat: float, coordinates: list) -> bool:
    outer_ring = coordinates[0]

    if not point_in_ring(lon, lat, outer_ring):
        return False

    for hole in coordinates[1:]:
        if point_in_ring(lon, lat, hole):
            return False

    return True


def point_in_geometry(lon: float, lat: float, geometry: dict) -> bool:
    geometry_type = geometry["type"]
    coordinates = geometry["coordinates"]

    if geometry_type == "Polygon":
        return point_in_polygon(lon, lat, coordinates)

    if geometry_type == "MultiPolygon":
        return any(point_in_polygon(lon, lat, polygon) for polygon in coordinates)

    return False


def polygon_centroid(ring: list[list[float]]) -> tuple[float, float]:
    area = 0.0
    centroid_x = 0.0
    centroid_y = 0.0

    for index in range(len(ring) - 1):
        x0, y0 = ring[index]
        x1, y1 = ring[index + 1]
        cross = x0 * y1 - x1 * y0
        area += cross
        centroid_x += (x0 + x1) * cross
        centroid_y += (y0 + y1) * cross

    if abs(area) < 1e-12:
        return ring[0][0], ring[0][1]

    area *= 0.5
    centroid_x /= 6 * area
    centroid_y /= 6 * area
    return centroid_x, centroid_y


def representative_point(geometry: dict) -> tuple[float, float]:
    geometry_type = geometry["type"]
    coordinates = geometry["coordinates"]

    if geometry_type == "Polygon":
        return polygon_centroid(coordinates[0])

    if geometry_type == "MultiPolygon":
        return polygon_centroid(coordinates[0][0])

    return 0.0, 0.0


def risk_level_from_prob(probability: float) -> str:
    if probability <= 0.30:
        return "Low"
    if probability <= 0.60:
        return "Medium"
    return "High"


def parse_iso_datetime(value: str | None):
    if not value or value == "None":
        return None

    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def build_boundary_summaries(boundary_geojson_path: Path, label_key: str):
    return _build_boundary_summaries_cached(
        str(boundary_geojson_path),
        label_key,
        RESULTS_JSON_PATH.stat().st_mtime_ns,
        boundary_geojson_path.stat().st_mtime_ns,
    )


@lru_cache(maxsize=8)
def _build_boundary_summaries_cached(
    boundary_geojson_path_str: str,
    label_key: str,
    _results_mtime_ns: int,
    _boundary_mtime_ns: int,
):
    boundary_geojson_path = Path(boundary_geojson_path_str)
    boundary_features = load_geojson_features(str(boundary_geojson_path))
    results = load_algorithm_results()

    summaries = []

    for feature in boundary_features:
        boundary_name = feature["properties"]["shapeName"]
        matched_cells = [
            result
            for result in results
            if point_in_geometry(result["longitude"], result["latitude"], feature["geometry"])
        ]

        if matched_cells:
            average_false_onset_probability = round(
                sum(cell["false_onset_probability"] for cell in matched_cells) / len(matched_cells),
                3,
            )
            average_crop_stress_probability = round(
                sum(cell["crop_stress_probability"] for cell in matched_cells) / len(matched_cells),
                3,
            )
            seasons_analyzed = max(cell["seasons_analyzed"] for cell in matched_cells)
            onset_detection_rate = round(
                sum(
                    (
                        cell["seasons_with_detected_onset"] / cell["seasons_analyzed"]
                        if cell["seasons_analyzed"]
                        else 0
                    )
                    for cell in matched_cells
                )
                / len(matched_cells),
                3,
            )
            first_onset_dates = [
                parse_iso_datetime(cell.get("first_detected_onset_date"))
                for cell in matched_cells
            ]
            latest_onset_dates = [
                parse_iso_datetime(cell.get("latest_detected_onset_date"))
                for cell in matched_cells
            ]
            valid_first_onset_dates = [value for value in first_onset_dates if value is not None]
            valid_latest_onset_dates = [value for value in latest_onset_dates if value is not None]
        else:
            average_false_onset_probability = 0.0
            average_crop_stress_probability = 0.0
            seasons_analyzed = 0
            onset_detection_rate = 0.0
            valid_first_onset_dates = []
            valid_latest_onset_dates = []

        overall_risk_probability = max(
            average_false_onset_probability,
            average_crop_stress_probability,
        )

        summaries.append(
            {
                label_key: boundary_name,
                "shape_id": feature["properties"].get("shapeID"),
                "grid_cell_count": len(matched_cells),
                "seasons_analyzed": seasons_analyzed,
                "onset_detection_rate": onset_detection_rate,
                "first_detected_onset_date": (
                    min(valid_first_onset_dates).isoformat(sep=" ")
                    if valid_first_onset_dates
                    else None
                ),
                "latest_detected_onset_date": (
                    max(valid_latest_onset_dates).isoformat(sep=" ")
                    if valid_latest_onset_dates
                    else None
                ),
                "average_false_onset_probability": average_false_onset_probability,
                "average_crop_stress_probability": average_crop_stress_probability,
                "overall_risk_probability": round(overall_risk_probability, 3),
                "overall_risk_level": risk_level_from_prob(overall_risk_probability),
            }
        )

    return summaries


def build_district_summaries():
    return build_boundary_summaries(DISTRICTS_GEOJSON_PATH, "district")


def build_ta_summaries():
    ta_summaries = build_boundary_summaries(TA_GEOJSON_PATH, "traditional_authority")
    district_features = load_geojson_features(str(DISTRICTS_GEOJSON_PATH))

    for summary, feature in zip(ta_summaries, load_geojson_features(str(TA_GEOJSON_PATH))):
        lon, lat = representative_point(feature["geometry"])
        parent_district = None

        for district_feature in district_features:
            if point_in_geometry(lon, lat, district_feature["geometry"]):
                parent_district = district_feature["properties"]["shapeName"]
                break

        summary["district"] = parent_district

    return ta_summaries
