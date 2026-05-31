#!/usr/bin/env python3
import json
from pathlib import Path

import geopandas as gpd

from backend.database.connection import get_connection

SHAPE_DIR = Path(__file__).resolve().parents[1] / "data" / "shapefiles"


def insert_gdf_to_table(gdf, table, admin_level=None, source_name=None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            for _, row in gdf.iterrows():
                props = row.drop(labels=['geometry']).to_dict()
                geom_wkt = row.geometry.wkt if row.geometry is not None else None

                if table == 'mw_boundary':
                    sql = """
                        INSERT INTO mw_boundary (
                            country_name,
                            source_name,
                            source_version,
                            shapename,
                            shapeiso,
                            shapeid,
                            shapegroup,
                            shapetype,
                            geom
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s,
                            ST_Multi(ST_MakeValid(ST_GeomFromText(%s, 4326)))
                        )
                    """
                    cur.execute(sql, (
                        props.get('shapeName') or props.get('name') or 'Malawi',
                        source_name,
                        None,
                        props.get('shapeName'),
                        props.get('shapeISO'),
                        props.get('shapeID'),
                        props.get('shapeGroup'),
                        props.get('shapeType'),
                        geom_wkt,
                    ))

                elif table == 'admin_boundaries':
                    sql = """
                        INSERT INTO admin_boundaries (
                            admin_level,
                            boundary_code,
                            boundary_name,
                            source_name,
                            source_version,
                            properties,
                            geom
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s::jsonb,
                            ST_Multi(ST_MakeValid(ST_GeomFromText(%s, 4326)))
                        )
                    """
                    boundary_name = (
                        props.get('shapeName') or
                        props.get('NAME') or
                        props.get('name') or
                        None
                    )
                    boundary_code = (
                        props.get('shapeID') or
                        props.get('GID_2') or
                        props.get('id') or
                        None
                    )
                    cur.execute(sql, (
                        admin_level,
                        boundary_code,
                        boundary_name,
                        source_name,
                        None,
                        json.dumps(props),
                        geom_wkt,
                    ))

                elif table == 'locations':
                    name = (
                        props.get('name') or
                        props.get('NAME') or
                        props.get('place_name') or
                        props.get('fclass') or
                        props.get('type') or
                        'Unknown'
                    )
                    if geom_wkt is None:
                        continue
                    sql = """
                        INSERT INTO locations (name, geom, metadata)
                        VALUES (%s, ST_GeomFromText(%s, 4326), %s::jsonb)
                    """
                    cur.execute(sql, (name, geom_wkt, json.dumps(props)))

        conn.commit()
    print(f"  Done inserting into {table} from {source_name}")


def main():
    sd = SHAPE_DIR
    if not sd.exists():
        print(f"Shapefiles directory not found: {sd}")
        return

    shp_files = sorted(sd.rglob('*.shp'))
    if not shp_files:
        print(f"No shapefiles found under: {sd}")
        return

    for shp in shp_files:
        parent = shp.parent.name.lower()
        print(f"\nReading {shp.name} ...")

        try:
            gdf = gpd.read_file(shp)
        except Exception as e:
            print(f"  Failed to read {shp}: {e}")
            continue

        try:
            gdf = gdf.to_crs(epsg=4326)
        except Exception:
            pass

        if 'adm0' in parent or 'country' in parent:
            print(f"  → mw_boundary")
            try:
                insert_gdf_to_table(gdf, 'mw_boundary', source_name=shp.stem)
            except Exception as e:
                print(f"  ERROR: {e}")

        elif any(k in parent for k in ('adm1', 'adm2', 'adm3', 'district', 'ta', 'region')):
            if 'adm1' in parent or 'region' in parent:
                level = 1
            elif 'adm2' in parent or 'district' in parent:
                level = 2
            elif 'adm3' in parent or 'ta' in parent:
                level = 3
            else:
                level = None
            print(f"  → admin_boundaries (level {level})")
            try:
                insert_gdf_to_table(gdf, 'admin_boundaries', admin_level=level, source_name=shp.stem)
            except Exception as e:
                print(f"  ERROR: {e}")

        elif 'location' in parent or 'location' in shp.stem.lower():
            print(f"  → locations")
            try:
                insert_gdf_to_table(gdf, 'locations', source_name=shp.stem)
            except Exception as e:
                print(f"  ERROR: {e}")

        else:
            print(f"  Skipping {shp.name} — unknown target table")


if __name__ == '__main__':
    main()