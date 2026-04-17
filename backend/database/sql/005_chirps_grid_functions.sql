create or replace function public.get_grid_cell_centroids()
returns table (
  grid_cell_id uuid,
  grid_id text,
  longitude double precision,
  latitude double precision
)
language sql
as $$
  select
    id as grid_cell_id,
    grid_id,
    st_x(centroid) as longitude,
    st_y(centroid) as latitude
  from public.grid_cells
  order by grid_id;
$$;


create or replace function public.upsert_grid_rainfall_batch(p_rows jsonb)
returns integer
language plpgsql
as $$
declare
  v_upserted_count integer;
begin
  insert into public.grid_rainfall (
    grid_cell_id,
    obs_date,
    rainfall_mm,
    assignment_method
  )
  select
    (row_data->>'grid_cell_id')::uuid,
    (row_data->>'obs_date')::date,
    (row_data->>'rainfall_mm')::numeric,
    coalesce(row_data->>'assignment_method', 'centroid_to_chirps_cell')
  from jsonb_array_elements(p_rows) as row_data
  on conflict (grid_cell_id, obs_date) do update
    set rainfall_mm = excluded.rainfall_mm,
        assignment_method = excluded.assignment_method;

  get diagnostics v_upserted_count = row_count;
  return v_upserted_count;
end;
$$;
