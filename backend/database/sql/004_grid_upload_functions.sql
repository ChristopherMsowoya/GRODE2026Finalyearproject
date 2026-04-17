create or replace function public.clear_grid_cells()
returns integer
language plpgsql
as $$
declare
  v_deleted_count integer;
begin
  delete from public.grid_cells
  where id is not null;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;


create or replace function public.insert_grid_cells_batch(p_rows jsonb)
returns integer
language plpgsql
as $$
declare
  v_inserted_count integer;
begin
  insert into public.grid_cells (
    grid_id,
    geom,
    centroid,
    area_km2
  )
  select
    row_data->>'grid_id',
    st_setsrid(st_geomfromgeojson((row_data->'geom')::text), 4326),
    st_setsrid(st_geomfromgeojson((row_data->'centroid')::text), 4326),
    ((row_data->>'area_km2')::numeric)
  from jsonb_array_elements(p_rows) as row_data;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;
