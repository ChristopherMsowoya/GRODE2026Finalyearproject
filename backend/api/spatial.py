from __future__ import annotations

from functools import lru_cache
import json
import math
from pathlib import Path
from datetime import datetime


PROJECT_ROOT = Path(__file__).resolve().parents[2]
LEGACY_DRY_PROBABILITY_KEY = "crop_" + "stress_probability"
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
PLACES_SHP_PATH = (
    PROJECT_ROOT
    / "backend"
    / "database"
    / "data"
    / "shapefiles"
    / "Location"
    / "hotosm_mwi_populated_places_points_shp.shp"
)


@lru_cache(maxsize=None)
def load_geojson_features(path: str):
    with Path(path).open("r", encoding="utf-8") as geojson_file:
        data = json.load(geojson_file)

    features = data["features"]
    for feature in features:
        feature["_bbox"] = geometry_bounds(feature["geometry"])
    return features


def geometry_bounds(geometry: dict) -> tuple[float, float, float, float]:
    coords = geometry["coordinates"]
    values: list[tuple[float, float]] = []

    def collect(node):
        if isinstance(node, list) and node and isinstance(node[0], (int, float)):
            values.append((float(node[0]), float(node[1])))
            return
        for child in node:
            collect(child)

    collect(coords)
    lons = [lon for lon, _lat in values]
    lats = [lat for _lon, lat in values]
    return min(lons), min(lats), max(lons), max(lats)


def bbox_contains(bbox: tuple[float, float, float, float], lon: float, lat: float) -> bool:
    min_lon, min_lat, max_lon, max_lat = bbox
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat


def load_algorithm_results():
    with RESULTS_JSON_PATH.open("r", encoding="utf-8") as results_file:
        results = json.load(results_file)

    normalized = []
    for result in results:
        row = dict(result)
        if "dry_spell_probability" not in row:
            row["dry_spell_probability"] = row.get(LEGACY_DRY_PROBABILITY_KEY, 0.0)
        row.pop(LEGACY_DRY_PROBABILITY_KEY, None)
        normalized.append(row)
    return normalized


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


def geometry_points(geometry: dict, step: int = 20) -> list[tuple[float, float]]:
    values: list[tuple[float, float]] = []

    def collect(node):
        if isinstance(node, list) and node and isinstance(node[0], (int, float)):
            values.append((float(node[0]), float(node[1])))
            return
        for child in node:
            collect(child)

    collect(geometry["coordinates"])
    if len(values) <= step:
        return values
    return values[::step] + values[-1:]


def parent_district_for_geometry(geometry: dict, district_features: list[dict]) -> str | None:
    sample_points = geometry_points(geometry)
    best_name = None
    best_count = 0

    for district_feature in district_features:
        count = 0
        for lon, lat in sample_points:
            if bbox_contains(district_feature["_bbox"], lon, lat) and point_in_geometry(lon, lat, district_feature["geometry"]):
                count += 1
        if count > best_count:
            best_count = count
            best_name = district_feature["properties"]["shapeName"]

    if best_name:
        return best_name

    lon, lat = representative_point(geometry)
    for district_feature in district_features:
        if bbox_contains(district_feature["_bbox"], lon, lat) and point_in_geometry(lon, lat, district_feature["geometry"]):
            return district_feature["properties"]["shapeName"]

    return None


def risk_level_from_prob(probability: float) -> str:
    if probability <= 0.30:
        return "Low"
    if probability <= 0.60:
        return "Medium"
    return "High"


def dry_spell_probability(result: dict) -> float:
    return result.get("dry_spell_probability", result.get(LEGACY_DRY_PROBABILITY_KEY, 0.0))


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
            if bbox_contains(feature["_bbox"], result["longitude"], result["latitude"])
            and point_in_geometry(result["longitude"], result["latitude"], feature["geometry"])
        ]

        if matched_cells:
            average_false_onset_probability = round(
                sum(cell["false_onset_probability"] for cell in matched_cells) / len(matched_cells),
                3,
            )
            average_dry_spell_probability = round(
                sum(dry_spell_probability(cell) for cell in matched_cells) / len(matched_cells),
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
            average_dry_spell_probability = 0.0
            seasons_analyzed = 0
            onset_detection_rate = 0.0
            valid_first_onset_dates = []
            valid_latest_onset_dates = []

        overall_risk_probability = max(
            average_false_onset_probability,
            average_dry_spell_probability,
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
                "average_dry_spell_probability": average_dry_spell_probability,
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
        summary["district"] = parent_district_for_geometry(feature["geometry"], district_features)

    return ta_summaries


@lru_cache(maxsize=1)
def load_places():
    try:
        import shapefile
    except Exception:
        return []

    if not PLACES_SHP_PATH.exists():
        return []

    reader = shapefile.Reader(str(PLACES_SHP_PATH))
    places = []
    for shape_record in reader.iterShapeRecords():
        record = shape_record.record.as_dict()
        name = record.get("name") or record.get("name_en") or record.get("name_ny")
        if not name or not shape_record.shape.points:
            continue
        lon, lat = shape_record.shape.points[0]
        places.append({
            "name": name,
            "place_type": record.get("place") or "place",
            "population": record.get("population") or None,
            "longitude": float(lon),
            "latitude": float(lat),
        })
    return places


def squared_distance(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    return math.pow(lon1 - lon2, 2) + math.pow(lat1 - lat2, 2)


def places_for_ta_feature(ta_feature: dict) -> list[dict]:
    places = []
    for place in load_places():
        if bbox_contains(ta_feature["_bbox"], place["longitude"], place["latitude"]) and point_in_geometry(
            place["longitude"],
            place["latitude"],
            ta_feature["geometry"],
        ):
            places.append(place)
    return places


@lru_cache(maxsize=32)
def get_grids_for_ta(ta_name: str, district_name: str = None) -> list:
    boundary_features = load_geojson_features(str(TA_GEOJSON_PATH))
    district_features = load_geojson_features(str(DISTRICTS_GEOJSON_PATH))
    results = load_algorithm_results()

    for feature in boundary_features:
        if feature["properties"]["shapeName"].lower() != ta_name.lower():
            continue

        if district_name:
            parent_district = parent_district_for_geometry(feature["geometry"], district_features)
            if parent_district and parent_district.lower() != district_name.lower():
                continue

        ta_places = places_for_ta_feature(feature)
        matched_cells = [
            dict(result)
            for result in results
            if bbox_contains(feature["_bbox"], result["longitude"], result["latitude"])
            and point_in_geometry(result["longitude"], result["latitude"], feature["geometry"])
        ]

        for index, cell in enumerate(matched_cells):
            lon = float(cell.get("longitude") or 0)
            lat = float(cell.get("latitude") or 0)
            nearest_place = min(
                ta_places,
                key=lambda place: squared_distance(lon, lat, place["longitude"], place["latitude"]),
                default=None,
            )
            if nearest_place:
                cell["area_name"] = nearest_place["name"]
                cell["area_place_type"] = nearest_place["place_type"]
                cell["area_latitude"] = nearest_place["latitude"]
                cell["area_longitude"] = nearest_place["longitude"]
            else:
                cell["area_name"] = f"Grid {cell.get('grid_id', index + 1)}"
                cell["area_place_type"] = "grid_cell"

        return matched_cells

    return []


def search_places(name: str, limit: int = 10) -> list[dict]:
    query = name.lower()
    matches = [place for place in load_places() if query in place["name"].lower()]
    matches.sort(key=lambda place: (
        0 if place["name"].lower().startswith(query) else 1,
        place["name"],
    ))
    return matches[:limit]
