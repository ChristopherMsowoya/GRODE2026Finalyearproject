# Rainfall Risk Algorithm

This module processes CHIRPS rainfall data and produces planting-risk outputs for Malawi.

The goal is to help answer a practical question:

"Based on rainfall behavior in this location, is it safer to plant now or should the farmer be cautious?"

The algorithm does not make the final farming decision by itself. Instead, it generates rainfall-based indicators that can support a farmer, advisor, or another backend service.

## What This Module Does

The pipeline:

1. Loads CHIRPS NetCDF rainfall files from `backend/algorithms/data/raw`
2. Combines all matching CHIRPS files into one time series
3. Subsets the data to Malawi by default
4. Loops through rainfall grid cells in Malawi
5. Detects seasonal onset dates
6. Estimates false onset risk
7. Estimates crop stress risk after onset
8. Writes machine-readable and human-readable output files

## Main Idea Behind The Algorithm

For each rainfall grid cell, the algorithm looks at each season and checks:

- when meaningful rainfall onset starts
- whether onset is followed by a long dry spell
- whether there is crop stress after onset

This is useful because early rain does not always mean planting is safe. A farmer may plant after the first strong rainfall event, but if a long dry spell follows, crops may fail or struggle.

## Current Onset and Risk Logic

### Onset detection

An onset is detected when:

- the 3-day rainfall total is at least `25 mm`
- the next 20 days do not contain a dry spell of `10 or more` consecutive dry days

### False onset

A false onset is counted when:

- onset was detected
- the next 20 days contain a dry spell of `10 or more` consecutive days
- a dry day is currently treated as rainfall below `1.0 mm`

### Crop stress

Crop stress is counted when:

- onset was detected
- the next 20 days contain a dry spell of `5 or more` consecutive days

## Folder Structure

- `data/raw/`
  Place CHIRPS NetCDF files here.
- `outputs/`
  Generated results are written here.
- `src/`
  Source code for ingestion, processing, algorithm rules, and pipeline execution.

## Input Data

The pipeline expects CHIRPS NetCDF files such as:

- `chirps-v2.0.2024.days_p25.nc`
- `chirps-v2.0.2025.days_p25.nc`
- `chirps-v2.0.2026.days_p25.nc`

You can place one file or many files in `data/raw`.

If multiple CHIRPS files are present, the loader combines them along the time dimension. This means the algorithm works better when more yearly files are available because the probabilities are then based on more seasons.

## Why More CHIRPS Files Matter

If only one season is loaded:

- `false_onset_probability` is basically a yes/no result for that season
- `crop_stress_probability` is also basically a yes/no result

If many seasons are loaded:

- the algorithm can estimate more realistic historical probabilities
- risk levels become more meaningful for decision support

In short:

- one file gives a seasonal snapshot
- multiple files give stronger long-term risk evidence

## How To Run

From the project root:

```powershell
cd backend/algorithms/src
python -c "from pipeline.run_pipeline import run; run()"
```

By default, the pipeline:

- reads from `backend/algorithms/data/raw`
- analyzes Malawi
- writes results to `backend/algorithms/outputs`

## FastAPI Backend

A FastAPI layer is available so the frontend can request results and trigger the pipeline.

Main API file:

- `backend/api/main.py`

### Install dependencies

From the project root:

```powershell
python -m pip install -r backend/algorithms/requirements.txt
```

### Run the API

From the project root:

```powershell
python -m uvicorn backend.api.main:app --reload
```

The API will be available at:

- `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`

### Available endpoints

- `GET /`
  Basic API info
- `GET /api/health`
  Health check
- `GET /api/results`
  Returns the latest generated algorithm results
- `POST /api/pipeline/run`
  Runs the pipeline and refreshes the outputs

Example request body for `POST /api/pipeline/run`:

```json
{
  "region": "malawi"
}
```

## Output Files

The pipeline generates:

- `backend/algorithms/outputs/results.json`
- `backend/algorithms/outputs/results.csv`

### Why both formats exist

- `JSON` is useful for backend services, APIs, and frontend integration
- `CSV` is useful for Excel, manual review, sorting, filtering, and reporting

## Output Fields Explained

Each row or object represents one CHIRPS rainfall grid cell.

### Core location fields

- `grid_id`
  Internal identifier for the rainfall grid cell.
- `latitude`
  Latitude of the grid cell center.
- `longitude`
  Longitude of the grid cell center.

### Seasonal coverage fields

- `seasons_analyzed`
  Number of seasons included for that grid cell.
- `seasons_with_detected_onset`
  Number of seasons where the algorithm found a valid onset.

### Onset fields

- `first_detected_onset_date`
  Earliest detected onset date from the analyzed seasons.
- `latest_detected_onset_date`
  Latest detected onset date from the analyzed seasons.

### Risk fields

- `false_onset_probability`
  Share of analyzed seasons where onset was followed by a long dry spell.
- `crop_stress_probability`
  Share of analyzed seasons where post-onset crop stress conditions were detected.
- `overall_risk_level`
  Final risk label based on the larger of the two probabilities.

### Human-readable interpretation fields

- `false_onset_interpretation`
  Plain-language explanation of the false onset result.
- `crop_stress_interpretation`
  Plain-language explanation of the crop stress result.

## Risk Level Meaning

Risk level is based on the larger of:

- `false_onset_probability`
- `crop_stress_probability`

Current rule:

- `Low` if probability is `0.30` or below
- `Medium` if probability is above `0.30` and up to `0.60`
- `High` if probability is above `0.60`

## Important Interpretation Note

These outputs are rainfall-grid based, not district-based.

That means:

- the algorithm currently produces results per CHIRPS grid cell
- it does not yet directly output by district, Traditional Authority, or Enumeration Area

If another team member is working with Malawi shapefiles and spatial layers, they will likely need to spatially join these grid results to:

- districts
- Traditional Authorities
- Enumeration Areas

That integration step belongs naturally with the location/shapefile/database work.

## What A Teammate Needs To Integrate This

A teammate can integrate this module if they know:

- where to place CHIRPS files: `backend/algorithms/data/raw`
- how to run the pipeline
- where outputs are written
- that outputs are at rainfall-grid level
- that more yearly CHIRPS files improve result quality

## Current Limitations

- The planting recommendation is indirect. The module provides rainfall-risk indicators, not a full recommendation engine.
- Results are only as strong as the amount and quality of CHIRPS data loaded.
- The module does not yet attach results to district or TA names.
- The module is currently Malawi-focused by default.

## TO RUN BACKEND
- python -m uvicorn backend.api.main:app --reload

## TO RUN FRONTEND
- npm run dev
