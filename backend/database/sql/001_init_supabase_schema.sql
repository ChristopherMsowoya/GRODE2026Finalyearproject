create extension if not exists postgis;
create extension if not exists pgcrypto;

create table if not exists public.districts (
  id uuid primary key default gen_random_uuid(),
  shape_id text unique,
  name text not null,
  geom geometry(MultiPolygon, 4326) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.traditional_authorities (
  id uuid primary key default gen_random_uuid(),
  shape_id text unique,
  district_id uuid references public.districts(id) on delete set null,
  name text not null,
  geom geometry(MultiPolygon, 4326) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.grid_cells (
  id uuid primary key default gen_random_uuid(),
  grid_id text unique not null,
  district_id uuid references public.districts(id) on delete set null,
  ta_id uuid references public.traditional_authorities(id) on delete set null,
  geom geometry(Polygon, 4326) not null,
  centroid geometry(Point, 4326) not null,
  area_km2 numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district_id uuid references public.districts(id) on delete set null,
  ta_id uuid references public.traditional_authorities(id) on delete set null,
  grid_cell_id uuid references public.grid_cells(id) on delete set null,
  geom geometry(Point, 4326) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  region text not null default 'malawi',
  status text not null default 'completed',
  source_files jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.chirps_observations (
  id uuid primary key default gen_random_uuid(),
  obs_date date not null,
  source_resolution text not null default '0.25_degree',
  source_lat double precision not null,
  source_lon double precision not null,
  source_point geometry(Point, 4326) not null,
  rainfall_mm numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.grid_rainfall (
  id uuid primary key default gen_random_uuid(),
  grid_cell_id uuid not null references public.grid_cells(id) on delete cascade,
  obs_date date not null,
  chirps_observation_id uuid references public.chirps_observations(id) on delete set null,
  rainfall_mm numeric not null,
  assignment_method text not null default 'centroid_to_chirps_cell',
  created_at timestamptz not null default now(),
  unique (grid_cell_id, obs_date)
);

create table if not exists public.grid_risk_results (
  id uuid primary key default gen_random_uuid(),
  pipeline_run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  grid_cell_id uuid not null references public.grid_cells(id) on delete cascade,
  seasons_analyzed integer not null default 0,
  seasons_with_detected_onset integer not null default 0,
  first_detected_onset_date timestamptz,
  latest_detected_onset_date timestamptz,
  false_onset_probability numeric not null default 0,
  crop_stress_probability numeric not null default 0,
  overall_risk_level text not null,
  false_onset_interpretation text,
  crop_stress_interpretation text,
  created_at timestamptz not null default now(),
  unique (pipeline_run_id, grid_cell_id)
);

create index if not exists districts_geom_gix
  on public.districts using gist (geom);

create index if not exists traditional_authorities_geom_gix
  on public.traditional_authorities using gist (geom);

create index if not exists grid_cells_geom_gix
  on public.grid_cells using gist (geom);

create index if not exists grid_cells_centroid_gix
  on public.grid_cells using gist (centroid);

create index if not exists locations_geom_gix
  on public.locations using gist (geom);

create index if not exists chirps_observations_point_gix
  on public.chirps_observations using gist (source_point);

create index if not exists grid_cells_district_idx
  on public.grid_cells (district_id);

create index if not exists grid_cells_ta_idx
  on public.grid_cells (ta_id);

create index if not exists grid_rainfall_date_idx
  on public.grid_rainfall (obs_date);

create index if not exists grid_risk_results_run_idx
  on public.grid_risk_results (pipeline_run_id);
