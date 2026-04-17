create or replace function public.upsert_district_boundary(
  p_shape_id text,
  p_name text,
  p_geom jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.districts (shape_id, name, geom, metadata)
  values (
    p_shape_id,
    p_name,
    st_multi(st_setsrid(st_geomfromgeojson(p_geom::text), 4326)),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (shape_id) do update
    set name = excluded.name,
        geom = excluded.geom,
        metadata = excluded.metadata
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.upsert_traditional_authority_boundary(
  p_shape_id text,
  p_name text,
  p_geom jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.traditional_authorities (shape_id, name, geom, metadata)
  values (
    p_shape_id,
    p_name,
    st_multi(st_setsrid(st_geomfromgeojson(p_geom::text), 4326)),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (shape_id) do update
    set name = excluded.name,
        geom = excluded.geom,
        metadata = excluded.metadata
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.link_traditional_authorities_to_districts()
returns integer
language plpgsql
as $$
declare
  v_updated_count integer;
begin
  with direct_matches as (
    update public.traditional_authorities ta
    set district_id = d.id
    from public.districts d
    where st_intersects(st_pointonsurface(ta.geom), d.geom)
      returning ta.id
  ),
  unmatched as (
    select
      ta.id as ta_id,
      (
        select d.id
        from public.districts d
        order by st_distance(
          st_pointonsurface(ta.geom),
          st_pointonsurface(d.geom)
        )
        limit 1
      ) as district_id
    from public.traditional_authorities ta
    where ta.district_id is null
  ),
  nearest_matches as (
    update public.traditional_authorities ta
    set district_id = unmatched.district_id
    from unmatched
    where ta.id = unmatched.ta_id
    returning ta.id
  ),
  updated as (
    select id from direct_matches
    union all
    select id from nearest_matches
  )
  select count(*) into v_updated_count from updated;

  return v_updated_count;
end;
$$;
