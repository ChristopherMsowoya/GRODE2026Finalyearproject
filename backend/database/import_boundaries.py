import json
from pathlib import Path

import shapefile

from backend.database.connection import get_connection

SHAPEFILES_ROOT = Path(__file__).resolve().parent / "data" / "shapefiles"

BOUNDARY_SOURCES = [
    (0, "ADM0(country)", "geoBoundaries-MWI-ADM0.shp"),
    (1, "ADM1(region)", "geoBoundaries-MWI-ADM1.shp"),
    (2, "ADM2(district)", "geoBoundaries-MWI-ADM2.shp"),
    (3, "ADM3(TA)", "geoBoundaries-MWI-ADM3.shp"),
]

SOURCE_NAME = "geoBoundaries"
SOURCE_VERSION = "full"


def shape_to_geojson(shape_record):
    return json.dumps(shape_record.shape.__geo_interface__)


def import_boundaries():
    from psycopg.types.json import Json

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "delete from mw_boundary where source_name = %s and source_version = %s",
                (SOURCE_NAME, SOURCE_VERSION),
            )
            cursor.execute(
                "delete from admin_boundaries where source_name = %s and source_version = %s",
                (SOURCE_NAME, SOURCE_VERSION),
            )

            for admin_level, folder_name, shapefile_name in BOUNDARY_SOURCES:
                shapefile_path = SHAPEFILES_ROOT / folder_name / shapefile_name
                reader = shapefile.Reader(str(shapefile_path))

                for shape_record in reader.iterShapeRecords():
                    properties = shape_record.record.as_dict()
                    boundary_name = properties.get("shapeName") or f"ADM{admin_level}"
                    boundary_code = properties.get("shapeID")
                    geometry_json = shape_to_geojson(shape_record)

                    if admin_level == 0:
                        cursor.execute(
                            """
                            insert into mw_boundary (
                              country_name,
                              source_name,
                              source_version,
                              geom
                            )
                            values (
                              %s,
                              %s,
                              %s,
                              st_multi(st_makevalid(st_setsrid(st_geomfromgeojson(%s), 4326)))
                            )
                            """,
                            (
                                boundary_name,
                                SOURCE_NAME,
                                SOURCE_VERSION,
                                geometry_json,
                            ),
                        )

                    cursor.execute(
                        """
                        insert into admin_boundaries (
                          admin_level,
                          boundary_code,
                          boundary_name,
                          source_name,
                          source_version,
                          properties,
                          geom
                        )
                        values (
                          %s,
                          %s,
                          %s,
                          %s,
                          %s,
                          %s,
                          st_multi(st_makevalid(st_setsrid(st_geomfromgeojson(%s), 4326)))
                        )
                        """,
                        (
                            admin_level,
                            boundary_code,
                            boundary_name,
                            SOURCE_NAME,
                            SOURCE_VERSION,
                            Json(properties),
                            geometry_json,
                        ),
                    )

        connection.commit()

    print("Boundary import completed.")


if __name__ == "__main__":
    import_boundaries()
