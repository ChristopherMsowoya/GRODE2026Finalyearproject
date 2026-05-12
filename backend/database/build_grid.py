from backend.database.connection import get_connection

GRID_SIZE_METERS = 5000
GRID_SOURCE = "esri_5km_v1"
PROJECTED_SRID = 32736


def build_grid():
    sql_delete_intersections = "delete from grid_admin_intersections;"

    sql_delete_cells = "delete from grid_cells where source_grid = %(source_grid)s;"

    sql_insert_cells = """
    with boundary as (
      select st_transform(st_unaryunion(st_collect(geom)), %(projected_srid)s) as geom
      from mw_boundary
      where country_name = 'Malawi'
    ),
    grid as (
      select (st_squaregrid(%(grid_size_meters)s, geom)).geom as geom
      from boundary
    ),
    clipped as (
      select
        (st_dump(
          st_collectionextract(
            st_makevalid(st_intersection(grid.geom, boundary.geom)),
            3
          )
        )).geom as geom
      from grid
      cross join boundary
      where st_intersects(grid.geom, boundary.geom)
    ),
    valid_cells as (
      select geom
      from clipped
      where not st_isempty(geom)
        and st_area(geom) > 0
    ),
    numbered_cells as (
      select
        row_number() over (order by st_y(st_centroid(geom)) desc, st_x(st_centroid(geom))) as cell_number,
        geom
      from valid_cells
    )
    insert into grid_cells (
      grid_id,
      grid_code,
      centroid_lat,
      centroid_lon,
      area_km2,
      source_grid,
      geom
    )
    select
      'MWI-5KM-' || lpad(cell_number::text, 5, '0') as grid_id,
      'MWI-5KM-' || lpad(cell_number::text, 5, '0') as grid_code,
      st_y(st_transform(st_pointonsurface(geom), 4326)) as centroid_lat,
      st_x(st_transform(st_pointonsurface(geom), 4326)) as centroid_lon,
      st_area(geom) / 1000000.0 as area_km2,
      %(source_grid)s as source_grid,
      st_transform(geom, 4326) as geom
    from numbered_cells;
    """

    sql_insert_intersections = """
    insert into grid_admin_intersections (
      grid_id,
      admin_boundary_id,
      overlap_area_km2,
      overlap_fraction
    )
    select
      grid_cells.grid_id,
      admin_boundaries.admin_boundary_id,
      st_area(
        st_transform(
          st_intersection(grid_cells.geom, admin_boundaries.geom),
          %(projected_srid)s
        )
      ) / 1000000.0 as overlap_area_km2,
      case
        when grid_cells.area_km2 > 0 then
          (
            st_area(
              st_transform(
                st_intersection(grid_cells.geom, admin_boundaries.geom),
                %(projected_srid)s
              )
            ) / 1000000.0
          ) / grid_cells.area_km2
        else null
      end as overlap_fraction
    from grid_cells
    join admin_boundaries
      on admin_boundaries.admin_level in (1, 2, 3)
     and st_intersects(grid_cells.geom, admin_boundaries.geom)
    where grid_cells.source_grid = %(source_grid)s;
    """

    params = {
        "grid_size_meters": GRID_SIZE_METERS,
        "projected_srid": PROJECTED_SRID,
        "source_grid": GRID_SOURCE,
    }

    with get_connection() as connection:
      with connection.cursor() as cursor:
        cursor.execute(sql_delete_intersections)
        cursor.execute(sql_delete_cells, params)
        cursor.execute(sql_insert_cells, params)
        cursor.execute(sql_insert_intersections, params)

      # commit after the cursor context (ensures statements are sent)
      connection.commit()

    print(f"{GRID_SIZE_METERS / 1000:.0f} km grid generation completed.")


if __name__ == "__main__":
    build_grid()
