from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from backend.database.connection import get_connection


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = PROJECT_ROOT / "backend" / "data" / "gis" / "enumeration_areas" / "malawi_eas_bnd.geojson"


def _read_geojson(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise ValueError(f"{path} is not a GeoJSON FeatureCollection.")
    return data["features"]


def _polygon_geometry_from_shape(shape: Any) -> dict[str, Any]:
    points = shape.points
    parts = list(shape.parts) + [len(points)]
    polygons = []

    for index in range(len(parts) - 1):
        ring = points[parts[index]:parts[index + 1]]
        if not ring:
            continue
        coordinates = [[float(lon), float(lat)] for lon, lat in ring]
        if coordinates[0] != coordinates[-1]:
            coordinates.append(coordinates[0])
        polygons.append([coordinates])

    if not polygons:
        raise ValueError("Shapefile feature has no polygon rings.")

    return {"type": "MultiPolygon", "coordinates": polygons}


def _read_shapefile(path: Path) -> list[dict[str, Any]]:
    try:
        import shapefile
    except ImportError as exc:
        raise RuntimeError("pyshp is required to import shapefiles. Install backend/algorithms/requirements.txt.") from exc

    reader = shapefile.Reader(str(path))
    features = []

    for shape_record in reader.iterShapeRecords():
        features.append({
            "type": "Feature",
            "properties": shape_record.record.as_dict(),
            "geometry": _polygon_geometry_from_shape(shape_record.shape),
        })

    return features


def _read_features(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() in {".geojson", ".json"}:
        return _read_geojson(path)
    if path.suffix.lower() == ".shp":
        return _read_shapefile(path)
    raise ValueError(f"Unsupported EA input format: {path.suffix}. Use GeoJSON or Shapefile.")


def _first_present(props: dict[str, Any], names: list[str], fallback: str = "") -> str:
    lower = {str(key).lower(): value for key, value in props.items()}
    for name in names:
        value = lower.get(name.lower())
        if value not in (None, ""):
            return str(value).strip()
    return fallback


def _clean_code(value: str) -> str:
    if value.endswith(".00000"):
        return value[:-6]
    return value


def _feature_payload(feature: dict[str, Any], index: int, source_dataset: str) -> tuple[str, str, str | None, str, str, str]:
    props = feature.get("properties") or {}
    geometry = feature.get("geometry")
    if not geometry:
        raise ValueError(f"Feature {index} has no geometry.")

    ea_id = _clean_code(_first_present(props, ["id", "ea_id", "eaid", "eacode", "ea_code", "code", "objectid"], f"ea-{index + 1}"))
    district = _first_present(props, ["district_name", "district", "dist_name", "admin2", "adm2_name"], "Unknown")
    ta = _first_present(props, ["ta_name", "ta", "traditional_authority", "traditional_authority_name"], "")
    ea_name = _first_present(props, ["ea_name", "ea", "name", "enumeration_area", "enumeration_area_name", "eacode"], ea_id)
    return ea_id, district, ta or None, ea_name, source_dataset, json.dumps(geometry)


def import_geojson(path: Path, source_dataset: str) -> int:
    features = _read_features(path)
    rows = [_feature_payload(feature, index, source_dataset) for index, feature in enumerate(features)]

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS enumeration_areas (
                    id TEXT PRIMARY KEY,
                    district_name TEXT NOT NULL,
                    ta_name TEXT,
                    ea_name TEXT NOT NULL,
                    source_dataset TEXT,
                    geometry geometry(MultiPolygon, 4326) NOT NULL
                );
                """
            )
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_enumeration_areas_geom ON enumeration_areas USING GIST (geometry);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_enumeration_areas_district ON enumeration_areas (district_name);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_enumeration_areas_ta ON enumeration_areas (ta_name);")
            cursor.execute("TRUNCATE enumeration_areas CASCADE;")
            cursor.executemany(
                """
                INSERT INTO enumeration_areas (id, district_name, ta_name, ea_name, source_dataset, geometry)
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
                )
                ON CONFLICT (id) DO UPDATE SET
                    district_name = EXCLUDED.district_name,
                    ta_name = EXCLUDED.ta_name,
                    ea_name = EXCLUDED.ea_name,
                    source_dataset = EXCLUDED.source_dataset,
                    geometry = EXCLUDED.geometry;
                """,
                rows,
            )
        connection.commit()
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Malawi Enumeration Area polygons into PostGIS.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--source-dataset", default="MASDAP geonode:eas_bnd")
    args = parser.parse_args()

    count = import_geojson(args.input, args.source_dataset)
    print(f"Imported {count} enumeration areas from {args.input}")


if __name__ == "__main__":
    main()
