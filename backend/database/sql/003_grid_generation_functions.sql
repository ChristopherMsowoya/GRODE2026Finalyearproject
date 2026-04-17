create or replace function public.rebuild_malawi_grid_5km_v3()
returns integer
language plpgsql
as $$
declare
  v_inserted_count integer;
begin
  perform set_config('statement_timeout', '0', true);

  delete from public.grid_cells
  where id is not null;

  with malawi_boundary as (
    select st_union(geom) as geom
    from public.districts
  ),
  boundary_utm as (
    select st_transform(geom, 32736) as geom
    from malawi_boundary
  ),
  bounds as (
    select
      (floor(st_xmin(geom) / 5000.0) * 5000.0)::integer as xmin,
      (floor(st_ymin(geom) / 5000.0) * 5000.0)::integer as ymin,
      (ceil(st_xmax(geom) / 5000.0) * 5000.0)::integer as xmax,
      (ceil(st_ymax(geom) / 5000.0) * 5000.0)::integer as ymax,
      geom
    from boundary_utm
  ),
  raw_grid as (
    select
      st_makeenvelope(x, y, x + 5000, y + 5000, 32736) as cell_geom
    from bounds,
    generate_series(xmin::bigint, (xmax - 5000)::bigint, 5000::bigint) as x,
    generate_series(ymin::bigint, (ymax - 5000)::bigint, 5000::bigint) as y
  ),
  filtered_grid as (
    select
      row_number() over (
        order by
          st_y(st_centroid(cell_geom)) desc,
          st_x(st_centroid(cell_geom)) asc
      ) as row_num,
      cell_geom
    from raw_grid
    cross join boundary_utm
    where st_contains(boundary_utm.geom, st_centroid(cell_geom))
  ),
  inserted as (
    insert into public.grid_cells (
      grid_id,
      geom,
      centroid,
      area_km2
    )
    select
      'MWI-5KM-' || lpad(row_num::text, 6, '0'),
      st_transform(cell_geom, 4326),
      st_transform(st_centroid(cell_geom), 4326),
      round((st_area(cell_geom) / 1000000.0)::numeric, 3)
    from filtered_grid
    returning id
  )
  select count(*) into v_inserted_count
  from inserted;

  return v_inserted_count;
end;
$$;


create or replace function public.assign_grid_cells_to_admin_areas()
returns jsonb
language plpgsql
as $$
declare
  v_district_linked integer;
  v_ta_linked integer;
  v_unmatched_districts integer;
  v_unmatched_tas integer;
begin
  update public.grid_cells
  set district_id = null,
      ta_id = null
  where id is not null;

  with district_matches as (
    update public.grid_cells gc
    set district_id = d.id
    from public.districts d
    where st_intersects(gc.centroid, d.geom)
    returning gc.id
  )
  select count(*) into v_district_linked
  from district_matches;

  with unmatched_districts as (
    select
      gc.id as grid_cell_id,
      (
        select d.id
        from public.districts d
        order by st_distance(gc.centroid, st_pointonsurface(d.geom))
        limit 1
      ) as district_id
    from public.grid_cells gc
    where gc.district_id is null
  )
  update public.grid_cells gc
  set district_id = unmatched_districts.district_id
  from unmatched_districts
  where gc.id = unmatched_districts.grid_cell_id;

  with ta_matches as (
    update public.grid_cells gc
    set ta_id = ta.id
    from public.traditional_authorities ta
    where st_intersects(gc.centroid, ta.geom)
    returning gc.id
  )
  select count(*) into v_ta_linked
  from ta_matches;

  with unmatched_tas as (
    select
      gc.id as grid_cell_id,
      (
        select ta.id
        from public.traditional_authorities ta
        order by st_distance(gc.centroid, st_pointonsurface(ta.geom))
        limit 1
      ) as ta_id
    from public.grid_cells gc
    where gc.ta_id is null
  )
  update public.grid_cells gc
  set ta_id = unmatched_tas.ta_id
  from unmatched_tas
  where gc.id = unmatched_tas.grid_cell_id;

  select count(*) into v_unmatched_districts
  from public.grid_cells
  where district_id is null;

  select count(*) into v_unmatched_tas
  from public.grid_cells
  where ta_id is null;

  return jsonb_build_object(
    'district_links_by_intersection', v_district_linked,
    'ta_links_by_intersection', v_ta_linked,
    'unmatched_districts', v_unmatched_districts,
    'unmatched_tas', v_unmatched_tas
  );
end;
$$;
