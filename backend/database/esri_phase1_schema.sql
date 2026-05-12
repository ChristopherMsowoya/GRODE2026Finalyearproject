-- ============================================================
-- ESRI Phase I — Full Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. MALAWI NATIONAL BOUNDARY
CREATE TABLE IF NOT EXISTS mw_boundary (
    id           SERIAL PRIMARY KEY,
    country_name TEXT NOT NULL DEFAULT 'Malawi',
    geom         GEOMETRY(MULTIPOLYGON, 4326)
);
CREATE INDEX IF NOT EXISTS idx_mw_boundary_geom ON mw_boundary USING GIST(geom);

-- 2. ADMIN BOUNDARIES (regions / districts / TAs)
CREATE TABLE IF NOT EXISTS admin_boundaries (
    admin_boundary_id TEXT PRIMARY KEY,
    admin_level       INTEGER NOT NULL,
    shape_name        TEXT NOT NULL,
    shape_id          TEXT,
    parent_id         TEXT,
    geom              GEOMETRY(MULTIPOLYGON, 4326)
);
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geom  ON admin_boundaries USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_level ON admin_boundaries(admin_level);
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_name  ON admin_boundaries(shape_name);

-- 3. GRID CELLS (5km x 5km)
CREATE TABLE IF NOT EXISTS grid_cells (
    grid_id      TEXT PRIMARY KEY,
    grid_code    TEXT NOT NULL,
    centroid_lat DOUBLE PRECISION,
    centroid_lon DOUBLE PRECISION,
    area_km2     DOUBLE PRECISION,
    source_grid  TEXT NOT NULL DEFAULT 'esri_5km_v1',
    geom         GEOMETRY(GEOMETRY, 4326)
);
CREATE INDEX IF NOT EXISTS idx_grid_cells_geom        ON grid_cells USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_grid_cells_source_grid ON grid_cells(source_grid);

-- 4. GRID-ADMIN INTERSECTIONS
CREATE TABLE IF NOT EXISTS grid_admin_intersections (
    id                BIGSERIAL PRIMARY KEY,
    grid_id           TEXT NOT NULL REFERENCES grid_cells(grid_id) ON DELETE CASCADE,
    admin_boundary_id TEXT NOT NULL REFERENCES admin_boundaries(admin_boundary_id) ON DELETE CASCADE,
    overlap_area_km2  DOUBLE PRECISION,
    overlap_fraction  DOUBLE PRECISION,
    UNIQUE (grid_id, admin_boundary_id)
);
CREATE INDEX IF NOT EXISTS idx_gai_grid_id  ON grid_admin_intersections(grid_id);
CREATE INDEX IF NOT EXISTS idx_gai_admin_id ON grid_admin_intersections(admin_boundary_id);

-- 5. DATASET VERSIONS
CREATE TABLE IF NOT EXISTS dataset_versions (
    dataset_version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_name       TEXT NOT NULL,
    version_tag        TEXT NOT NULL,
    temporal_coverage  TEXT,
    spatial_resolution TEXT,
    source_url         TEXT,
    ingestion_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes              TEXT
);

-- 6. ALGORITHM VERSIONS
CREATE TABLE IF NOT EXISTS algorithm_versions (
    algorithm_version_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    algorithm_name       TEXT NOT NULL,
    version_tag          TEXT NOT NULL,
    description          TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PIPELINE RUNS
CREATE TABLE IF NOT EXISTS pipeline_runs (
    pipeline_run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_name        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    region          TEXT,
    output_uri      TEXT,
    metadata        JSONB,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. PIPELINE RESULTS JSON (staging)
CREATE TABLE IF NOT EXISTS pipeline_results_json (
    result_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_run_id UUID REFERENCES pipeline_runs(pipeline_run_id) ON DELETE CASCADE,
    grid_id         TEXT REFERENCES grid_cells(grid_id),
    result          JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prj_pipeline_run_id ON pipeline_results_json(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_prj_grid_id         ON pipeline_results_json(grid_id);

-- 9. DAILY RAINFALL
CREATE TABLE IF NOT EXISTS daily_rainfall (
    rainfall_id    BIGSERIAL PRIMARY KEY,
    grid_id        TEXT NOT NULL REFERENCES grid_cells(grid_id) ON DELETE CASCADE,
    rainfall_date  DATE NOT NULL,
    rainfall_mm    DOUBLE PRECISION NOT NULL,
    source_dataset TEXT,
    quality_flag   TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (grid_id, rainfall_date, source_dataset)
);
CREATE INDEX IF NOT EXISTS idx_daily_rainfall_grid_date ON daily_rainfall(grid_id, rainfall_date);
CREATE INDEX IF NOT EXISTS idx_daily_rainfall_date      ON daily_rainfall(rainfall_date);

-- 10. SEASONAL ONSET
CREATE TABLE IF NOT EXISTS seasonal_onset (
    onset_id                   BIGSERIAL PRIMARY KEY,
    grid_id                    TEXT NOT NULL REFERENCES grid_cells(grid_id) ON DELETE CASCADE,
    season_year                INTEGER NOT NULL,
    onset_date                 DATE,
    onset_day_of_year          INTEGER,
    onset_valid                BOOLEAN NOT NULL DEFAULT FALSE,
    trigger_rainfall_mm        DOUBLE PRECISION,
    persistence_passed         BOOLEAN,
    baseline_start             INTEGER,
    baseline_end               INTEGER,
    first_detected_onset_date  DATE,
    latest_detected_onset_date DATE,
    seasons_analyzed           INTEGER,
    dataset_version_id         UUID REFERENCES dataset_versions(dataset_version_id),
    algorithm_version_id       UUID REFERENCES algorithm_versions(algorithm_version_id),
    pipeline_run_id            UUID REFERENCES pipeline_runs(pipeline_run_id),
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (grid_id, season_year, dataset_version_id, algorithm_version_id)
);
CREATE INDEX IF NOT EXISTS idx_seasonal_onset_grid_year ON seasonal_onset(grid_id, season_year);

-- 11. FALSE ONSET EVENTS
CREATE TABLE IF NOT EXISTS false_onset_events (
    false_onset_id         BIGSERIAL PRIMARY KEY,
    grid_id                TEXT NOT NULL REFERENCES grid_cells(grid_id) ON DELETE CASCADE,
    season_year            INTEGER NOT NULL,
    trigger_date           DATE,
    rainfall_total_3day_mm DOUBLE PRECISION,
    dry_spell_days         INTEGER,
    failure_confirmed      BOOLEAN NOT NULL DEFAULT TRUE,
    dataset_version_id     UUID REFERENCES dataset_versions(dataset_version_id),
    algorithm_version_id   UUID REFERENCES algorithm_versions(algorithm_version_id),
    pipeline_run_id        UUID REFERENCES pipeline_runs(pipeline_run_id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_false_onset_events_grid_year ON false_onset_events(grid_id, season_year);

-- 12. FALSE ONSET PROBABILITY
CREATE TABLE IF NOT EXISTS false_onset_probability (
    probability_id          BIGSERIAL PRIMARY KEY,
    grid_id                 TEXT NOT NULL REFERENCES grid_cells(grid_id) ON DELETE CASCADE,
    baseline_start          INTEGER NOT NULL,
    baseline_end            INTEGER NOT NULL,
    false_onset_probability DOUBLE PRECISION NOT NULL,
    total_false_events      INTEGER NOT NULL DEFAULT 0,
    total_seasons           INTEGER NOT NULL DEFAULT 0,
    dataset_version_id      UUID REFERENCES dataset_versions(dataset_version_id),
    algorithm_version_id    UUID REFERENCES algorithm_versions(algorithm_version_id),
    pipeline_run_id         UUID REFERENCES pipeline_runs(pipeline_run_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (grid_id, baseline_start, baseline_end, dataset_version_id, algorithm_version_id)
);
CREATE INDEX IF NOT EXISTS idx_fop_grid_id  ON false_onset_probability(grid_id);
CREATE INDEX IF NOT EXISTS idx_fop_baseline ON false_onset_probability(baseline_start, baseline_end);

-- 13. DRY SPELL EVENTS
CREATE TABLE IF NOT EXISTS dry_spell_events (
    dry_spell_id             BIGSERIAL PRIMARY KEY,
    grid_id                  TEXT NOT NULL REFERENCES grid_cells(grid_id) ON DELETE CASCADE,
    season_year              INTEGER NOT NULL,
    onset_date               DATE,
    dry_spell_threshold      INTEGER NOT NULL,
    dry_spell_detected       BOOLEAN NOT NULL DEFAULT FALSE,
    max_consecutive_dry_days INTEGER,
    dataset_version_id       UUID REFERENCES dataset_versions(dataset_version_id),
    algorithm_version_id     UUID REFERENCES algorithm_versions(algorithm_version_id),
    pipeline_run_id          UUID REFERENCES pipeline_runs(pipeline_run_id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dry_spell_events_grid_year  ON dry_spell_events(grid_id, season_year);
CREATE INDEX IF NOT EXISTS idx_dry_spell_events_threshold  ON dry_spell_events(dry_spell_threshold);

-- 14. DRY SPELL PROBABILITY
CREATE TABLE IF NOT EXISTS dry_spell_probability (
    probability_id        BIGSERIAL PRIMARY KEY,
    grid_id               TEXT NOT NULL REFERENCES grid_cells(grid_id) ON DELETE CASCADE,
    baseline_start        INTEGER NOT NULL,
    baseline_end          INTEGER NOT NULL,
    dry_spell_threshold   INTEGER NOT NULL,
    dry_spell_probability DOUBLE PRECISION NOT NULL,
    total_seasons         INTEGER NOT NULL DEFAULT 0,
    dataset_version_id    UUID REFERENCES dataset_versions(dataset_version_id),
    algorithm_version_id  UUID REFERENCES algorithm_versions(algorithm_version_id),
    pipeline_run_id       UUID REFERENCES pipeline_runs(pipeline_run_id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (grid_id, baseline_start, baseline_end, dry_spell_threshold, dataset_version_id, algorithm_version_id)
);
CREATE INDEX IF NOT EXISTS idx_dsp_grid_id   ON dry_spell_probability(grid_id);
CREATE INDEX IF NOT EXISTS idx_dsp_baseline  ON dry_spell_probability(baseline_start, baseline_end);
CREATE INDEX IF NOT EXISTS idx_dsp_threshold ON dry_spell_probability(dry_spell_threshold);

-- 15. ONSET CLIMATOLOGY
CREATE TABLE IF NOT EXISTS onset_climatology (
    climatology_id        BIGSERIAL PRIMARY KEY,
    grid_id               TEXT NOT NULL REFERENCES grid_cells(grid_id) ON DELETE CASCADE,
    baseline_start        INTEGER NOT NULL,
    baseline_end          INTEGER NOT NULL,
    seasons_analyzed      INTEGER NOT NULL DEFAULT 0,
    median_onset_doy      INTEGER,
    p10_onset_doy         INTEGER,
    p90_onset_doy         INTEGER,
    onset_spread_days     INTEGER,
    onset_variability_std DOUBLE PRECISION,
    onset_detection_rate  DOUBLE PRECISION,
    dataset_version_id    UUID REFERENCES dataset_versions(dataset_version_id),
    algorithm_version_id  UUID REFERENCES algorithm_versions(algorithm_version_id),
    pipeline_run_id       UUID REFERENCES pipeline_runs(pipeline_run_id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (grid_id, baseline_start, baseline_end, dataset_version_id, algorithm_version_id)
);
CREATE INDEX IF NOT EXISTS idx_onset_clim_grid_id  ON onset_climatology(grid_id);
CREATE INDEX IF NOT EXISTS idx_onset_clim_baseline ON onset_climatology(baseline_start, baseline_end);

-- Done!
SELECT 'ESRI Phase I schema created successfully' AS status;
