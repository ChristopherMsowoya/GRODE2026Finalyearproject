create or replace function public.clear_locations()
returns integer
language plpgsql
as $$
declare
  v_deleted_count integer;
begin
  delete from public.locations
  where id is not null;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;


create or replace function public.insert_locations_batch(p_rows jsonb)
returns integer
language plpgsql
as $$
declare
  v_inserted_count integer;
begin
  insert into public.locations (
    name,
    district_id,
    ta_id,
    grid_cell_id,
    geom,
    metadata
  )
  select
    row_data->>'name',
    (
      select d.id
      from public.districts d
      where st_intersects(
        st_setsrid(st_geomfromgeojson((row_data->'geom')::text), 4326),
        d.geom
      )
      limit 1
    ),
    (
      select ta.id
      from public.traditional_authorities ta
      where st_intersects(
        st_setsrid(st_geomfromgeojson((row_data->'geom')::text), 4326),
        ta.geom
      )
      limit 1
    ),
    (
      select gc.id
      from public.grid_cells gc
      where st_intersects(
        st_setsrid(st_geomfromgeojson((row_data->'geom')::text), 4326),
        gc.geom
      )
      limit 1
    ),
    st_setsrid(st_geomfromgeojson((row_data->'geom')::text), 4326),
    coalesce(row_data->'metadata', '{}'::jsonb)
  from jsonb_array_elements(p_rows) as row_data;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;


create or replace function public.get_ta_grid_counts()
returns table (
  traditional_authority text,
  district text,
  grid_cell_count bigint
)
language sql
as $$
  select
    ta.name as traditional_authority,
    d.name as district,
    count(gc.id) as grid_cell_count
  from public.traditional_authorities ta
  left join public.districts d on d.id = ta.district_id
  left join public.grid_cells gc on gc.ta_id = ta.id
  group by ta.name, d.name
  order by ta.name, d.name;
$$;


create or replace function public.search_locations(name_query text, result_limit integer default 10)
returns table (
  location_name text,
  district text,
  traditional_authority text,
  grid_id text,
  longitude double precision,
  latitude double precision,
  place_type text,
  population text
)
language sql
as $$
  select
    l.name as location_name,
    d.name as district,
    ta.name as traditional_authority,
    gc.grid_id,
    st_x(l.geom) as longitude,
    st_y(l.geom) as latitude,
    l.metadata->>'place' as place_type,
    l.metadata->>'population' as population
  from public.locations l
  left join public.districts d on d.id = l.district_id
  left join public.traditional_authorities ta on ta.id = l.ta_id
  left join public.grid_cells gc on gc.id = l.grid_cell_id
  where l.name ilike '%' || name_query || '%'
  order by
    case when lower(l.name) = lower(name_query) then 0 else 1 end,
    l.name
  limit result_limit;
$$;
