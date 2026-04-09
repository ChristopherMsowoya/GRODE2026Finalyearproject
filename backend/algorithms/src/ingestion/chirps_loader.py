# ingestion/chirps_loader.py

from pathlib import Path

import xarray as xr


def normalize_chirps_dataset(ds):
    rename_map = {}

    if "latitude" in ds.coords and "lat" not in ds.coords:
        rename_map["latitude"] = "lat"

    if "longitude" in ds.coords and "lon" not in ds.coords:
        rename_map["longitude"] = "lon"

    if rename_map:
        ds = ds.rename(rename_map)

    return ds


def resolve_chirps_files(path_or_dir):
    path = Path(path_or_dir).expanduser().resolve()

    if path.is_dir():
        files = sorted(path.glob("chirps-v*.nc"))
    elif path.exists():
        files = [path]
    else:
        files = []

    if not files:
        raise FileNotFoundError(f"No CHIRPS NetCDF files found at {path}")

    return files


def load_chirps(path_or_dir):
    filepaths = resolve_chirps_files(path_or_dir)
    datasets = []

    for filepath in filepaths:
        ds = xr.open_dataset(filepath)
        datasets.append(normalize_chirps_dataset(ds))

    if len(datasets) == 1:
        return datasets[0].sortby("time")

    combined = xr.concat(datasets, dim="time").sortby("time")
    combined = combined.sel(time=~combined.get_index("time").duplicated())
    return combined
