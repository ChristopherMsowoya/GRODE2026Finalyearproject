-- ESRI Phase I foundational database schema.
-- Target: PostgreSQL + PostGIS, compatible with Supabase Postgres.

begin;

create extension if not exists postgis;
create extension if not exists pgcrypto;

drop view if exists latest_dry_spell_risk_map;
drop view if exists latest_false_onset_risk_map;
drop view if exists latest_onset_map;

drop function if exists create_daily_rainfall_year_partition(integer);

drop table if exists rainfall_ingestion_checks cascade;
drop table if exists dry_spell_probability cascade;
drop table if exists false_onset_probability cascade;
drop table if exists onset_climatology cascade;
drop table if exists dry_spell_events cascade;
drop table if exists false_onset_events cascade;
drop table if exists seasonal_onset cascade;
drop table if exists daily_rainfall cascade;
drop table if exists grid_admin_intersections cascade;
drop table if exists grid_cells cascade;
drop table if exists admin_boundaries cascade;
drop table if exists mw_boundary cascade;
drop table if exists pipeline_runs cascade;
drop table if exists algorithm_versions cascade;
drop table if exists dataset_versions cascade;

create table dataset_versions (
  dataset_version_id uuid primary key default gen_random_uuid(),
  dataset_name text not null,
  version_tag text not null,
  source_model text,
  temporal_start date,
  temporal_end date,
  spatial_resolution text,
  ingestion_date timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (dataset_name, version_tag)
);

create table algorithm_versions (
  algorithm_version_id uuid primary key default gen_random_uuid(),
  algorithm_name text not null,
  version_tag text not null,
  description text,
  parameters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (algorithm_name, version_tag)
);

create table pipeline_runs (
  pipeline_run_id uuid primary key default gen_random_uuid(),
  run_name text,
  dataset_version_id uuid references dataset_versions(dataset_version_id),
  algorithm_version_id uuid references algorithm_versions(algorithm_version_id),
  region text not null default 'malawi',
  baseline_start integer,
  baseline_end integer,
  status text not null default 'started'
    check (status in ('started', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  input_uri text,
  output_uri text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table mw_boundary (
  boundary_id uuid primary key default gen_random_uuid(),
  country_name text not null default 'Malawi',
  source_name text,
  source_version text,
  geom geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mw_boundary_geom
  on mw_boundary using gist (geom);

create table admin_boundaries (
  admin_boundary_id uuid primary key default gen_random_uuid(),
  admin_level integer not null check (admin_level between 0 and 4),
  boundary_code text,
  boundary_name text not null,
  parent_boundary_id uuid references admin_boundaries(admin_boundary_id),
  source_name text,
  source_version text,
  properties jsonb not null default '{}'::jsonb,
  geom geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_boundaries_level_name
  on admin_boundaries (admin_level, boundary_name);

create index if not exists idx_admin_boundaries_geom
  on admin_boundaries using gist (geom);

create table grid_cells (
  grid_id text primary key,
  grid_code text not null unique,
  centroid_lat double precision not null,
  centroid_lon double precision not null,
  area_km2 double precision,
  source_grid text not null default 'esri_5km_v1',
  properties jsonb not null default '{}'::jsonb,
  geom geometry(Polygon, 4326) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_grid_cells_geom
  on grid_cells using gist (geom);

create index if not exists idx_grid_cells_centroid
  on grid_cells (centroid_lat, centroid_lon);

create table grid_admin_intersections (
  grid_admin_intersection_id uuid primary key default gen_random_uuid(),
  grid_id text not null references grid_cells(grid_id) on delete cascade,
  admin_boundary_id uuid not null references admin_boundaries(admin_boundary_id) on delete cascade,
  overlap_area_km2 double precision,
  overlap_fraction double precision,
  unique (grid_id, admin_boundary_id)
);

create index if not exists idx_grid_admin_intersections_grid
  on grid_admin_intersections (grid_id);

create index if not exists idx_grid_admin_intersections_admin
  on grid_admin_intersections (admin_boundary_id);

create table daily_rainfall (
  rainfall_id bigserial,
  grid_id text not null references grid_cells(grid_id) on delete cascade,
  rainfall_date date not null,
  rainfall_mm double precision not null check (rainfall_mm >= 0),
  dataset_version_id uuid not null references dataset_versions(dataset_version_id),
  source_dataset text not null,
  quality_flag text not null default 'unchecked',
  created_at timestamptz not null default now(),
  primary key (rainfall_id, rainfall_date),
  unique (grid_id, rainfall_date, dataset_version_id)
) partition by range (rainfall_date);

create index if not exists idx_daily_rainfall_grid_date
  on daily_rainfall (grid_id, rainfall_date);

create index if not exists idx_daily_rainfall_dataset_date
  on daily_rainfall (dataset_version_id, rainfall_date);

create table rainfall_ingestion_checks (
  ingestion_check_id uuid primary key default gen_random_uuid(),
  dataset_version_id uuid not null references dataset_versions(dataset_version_id),
  check_name text not null,
  check_status text not null check (check_status in ('passed', 'warning', 'failed')),
  checked_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);

create table seasonal_onset (
  onset_id bigserial primary key,
  grid_id text not null references grid_cells(grid_id) on delete cascade,
  season_year integer not null,
  onset_date date,
  onset_day_of_year integer,
  onset_valid boolean not null default false,
  trigger_date date,
  trigger_rainfall_3day double precision,
  persistence_passed boolean not null default false,
  dry_spell_limit_days integer not null default 10,
  evaluation_window_days integer not null default 20,
  dataset_version_id uuid references dataset_versions(dataset_version_id),
  algorithm_version_id uuid references algorithm_versions(algorithm_version_id),
  pipeline_run_id uuid references pipeline_runs(pipeline_run_id),
  created_at timestamptz not null default now(),
  unique (grid_id, season_year, dataset_version_id, algorithm_version_id)
);

create index if not exists idx_seasonal_onset_grid_year
  on seasonal_onset (grid_id, season_year);

create index if not exists idx_seasonal_onset_year_valid
  on seasonal_onset (season_year, onset_valid);

create table false_onset_events (
  false_onset_id bigserial primary key,
  grid_id text not null references grid_cells(grid_id) on delete cascade,
  season_year integer not null,
  trigger_date date not null,
  rainfall_total_3day double precision not null,
  dry_spell_days integer not null,
  failure_confirmed boolean not null default true,
  evaluation_window_days integer not null default 20,
  dataset_version_id uuid references dataset_versions(dataset_version_id),
  algorithm_version_id uuid references algorithm_versions(algorithm_version_id),
  pipeline_run_id uuid references pipeline_runs(pipeline_run_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_false_onset_events_grid_year
  on false_onset_events (grid_id, season_year);

create index if not exists idx_false_onset_events_year
  on false_onset_events (season_year);

create table dry_spell_events (
  dry_spell_id bigserial primary key,
  grid_id text not null references grid_cells(grid_id) on delete cascade,
  season_year integer not null,
  onset_date date,
  dry_spell_threshold integer not null,
  dry_spell_detected boolean not null default false,
  max_consecutive_dry_days integer not null default 0,
  evaluation_window_days integer not null default 20,
  dataset_version_id uuid references dataset_versions(dataset_version_id),
  algorithm_version_id uuid references algorithm_versions(algorithm_version_id),
  pipeline_run_id uuid references pipeline_runs(pipeline_run_id),
  created_at timestamptz not null default now(),
  unique (grid_id, season_year, dry_spell_threshold, dataset_version_id, algorithm_version_id)
);

create index if not exists idx_dry_spell_events_grid_year
  on dry_spell_events (grid_id, season_year);

create index if not exists idx_dry_spell_events_year_threshold
  on dry_spell_events (season_year, dry_spell_threshold);

create table onset_climatology (
  climatology_id bigserial primary key,
  grid_id text not null references grid_cells(grid_id) on delete cascade,
  baseline_start integer not null,
  baseline_end integer not null,
  median_onset_doy integer,
  p10_onset_doy integer,
  p90_onset_doy integer,
  onset_spread_days integer,
  onset_variability_std double precision,
  valid_seasons integer not null default 0,
  dataset_version_id uuid references dataset_versions(dataset_version_id),
  algorithm_version_id uuid references algorithm_versions(algorithm_version_id),
  pipeline_run_id uuid references pipeline_runs(pipeline_run_id),
  created_at timestamptz not null default now(),
  unique (grid_id, baseline_start, baseline_end, dataset_version_id, algorithm_version_id)
);

create index if not exists idx_onset_climatology_baseline
  on onset_climatology (baseline_start, baseline_end);

create table false_onset_probability (
  probability_id bigserial primary key,
  grid_id text not null references grid_cells(grid_id) on delete cascade,
  baseline_start integer not null,
  baseline_end integer not null,
  false_onset_probability double precision not null check (
    false_onset_probability >= 0 and false_onset_probability <= 1
  ),
  total_false_events integer not null default 0,
  total_seasons integer not null default 0,
  dataset_version_id uuid references dataset_versions(dataset_version_id),
  algorithm_version_id uuid references algorithm_versions(algorithm_version_id),
  pipeline_run_id uuid references pipeline_runs(pipeline_run_id),
  created_at timestamptz not null default now(),
  unique (grid_id, baseline_start, baseline_end, dataset_version_id, algorithm_version_id)
);

create index if not exists idx_false_onset_probability_baseline
  on false_onset_probability (baseline_start, baseline_end);

create table dry_spell_probability (
  probability_id bigserial primary key,
  grid_id text not null references grid_cells(grid_id) on delete cascade,
  baseline_start integer not null,
  baseline_end integer not null,
  dry_spell_threshold integer not null,
  probability_value double precision not null check (
    probability_value >= 0 and probability_value <= 1
  ),
  total_events integer not null default 0,
  total_seasons integer not null default 0,
  dataset_version_id uuid references dataset_versions(dataset_version_id),
  algorithm_version_id uuid references algorithm_versions(algorithm_version_id),
  pipeline_run_id uuid references pipeline_runs(pipeline_run_id),
  created_at timestamptz not null default now(),
  unique (
    grid_id,
    baseline_start,
    baseline_end,
    dry_spell_threshold,
    dataset_version_id,
    algorithm_version_id
  )
);

create index if not exists idx_dry_spell_probability_baseline_threshold
  on dry_spell_probability (baseline_start, baseline_end, dry_spell_threshold);

create or replace function create_daily_rainfall_year_partition(target_year integer)
returns void
language plpgsql
as $$
declare
  partition_name text := format('daily_rainfall_%s', target_year);
  start_date date := make_date(target_year, 1, 1);
  end_date date := make_date(target_year + 1, 1, 1);
begin
  execute format(
    'create table if not exists %I partition of daily_rainfall for values from (%L) to (%L)',
    partition_name,
    start_date,
    end_date
  );
end;
$$;

create or replace view latest_onset_map as
select distinct on (so.grid_id)
  so.grid_id,
  gc.grid_code,
  so.season_year,
  so.onset_date,
  so.onset_day_of_year,
  so.onset_valid,
  gc.geom
from seasonal_onset so
join grid_cells gc on gc.grid_id = so.grid_id
order by so.grid_id, so.season_year desc, so.created_at desc;

create or replace view latest_false_onset_risk_map as
select distinct on (fop.grid_id)
  fop.grid_id,
  gc.grid_code,
  fop.baseline_start,
  fop.baseline_end,
  fop.false_onset_probability,
  gc.geom
from false_onset_probability fop
join grid_cells gc on gc.grid_id = fop.grid_id
order by fop.grid_id, fop.baseline_end desc, fop.created_at desc;

create or replace view latest_dry_spell_risk_map as
select distinct on (dsp.grid_id, dsp.dry_spell_threshold)
  dsp.grid_id,
  gc.grid_code,
  dsp.baseline_start,
  dsp.baseline_end,
  dsp.dry_spell_threshold,
  dsp.probability_value,
  gc.geom
from dry_spell_probability dsp
join grid_cells gc on gc.grid_id = dsp.grid_id
order by dsp.grid_id, dsp.dry_spell_threshold, dsp.baseline_end desc, dsp.created_at desc;

insert into algorithm_versions (
  algorithm_name,
  version_tag,
  description,
  parameters
)
values (
  'OD-1 Primary Operational Definition',
  'v1.0-foundation',
  'Three-day rainfall trigger with 20-day persistence window and dry-spell checks.',
  '{
    "trigger_rainfall_mm": 25,
    "trigger_window_days": 3,
    "persistence_window_days": 20,
    "false_onset_dry_spell_days": 10,
    "dry_spell_thresholds": [5, 7, 9],
    "dry_day_threshold_mm": 1.0
  }'::jsonb
)
on conflict (algorithm_name, version_tag) do nothing;

commit;
