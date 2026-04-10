# ingestion/chirps_loader.py

from pathlib import Path
import time

import xarray as xr


def normalize_chirps_dataset(ds):
    rename_map = {}

    if "latitude" in ds.coords and "lat" not in ds.coords:
        rename_map["latitude"] = "lat"

    if "longitude" in ds.coords and "lon" not in ds.coords:
        rename_map["longitude"] = "lon"

    if rename_map:
        ds = ds.rename(rename_map)

    if "precip" in ds.data_vars:
        ds["precip"] = ds["precip"].transpose("time", "lat", "lon")

    ds = ds.sortby("lat").sortby("lon").sortby("time")

    return ds


def subset_to_bounds(ds, bounds):
    if not bounds:
        return ds

    lat_min, lat_max = sorted(bounds["lat"])
    lon_min, lon_max = sorted(bounds["lon"])

    return ds.sel(
        lat=slice(lat_min, lat_max),
        lon=slice(lon_min, lon_max)
    )


def resolve_chirps_files(path_or_dir):
    path = Path(path_or_dir).expanduser().resolve()

    if path.is_dir():
        patterns = ("chirps-v*.nc", "CHIRPS*.nc")
        file_set = {
            filepath.resolve()
            for pattern in patterns
            for filepath in path.glob(pattern)
        }
        files = sorted(file_set)
    elif path.exists():
        files = [path]
    else:
        files = []

    if not files:
        raise FileNotFoundError(f"No CHIRPS NetCDF files found at {path}")

    return files


def load_chirps(path_or_dir, bounds=None):
    filepaths = resolve_chirps_files(path_or_dir)
    datasets = []

    for filepath in filepaths:
        ds = xr.open_dataset(filepath)
        ds = normalize_chirps_dataset(ds)
        ds = subset_to_bounds(ds, bounds)

        if ds.sizes.get("lat", 0) == 0 or ds.sizes.get("lon", 0) == 0:
            continue

        datasets.append(ds)

    if not datasets:
        raise ValueError("No CHIRPS datasets contained data for the requested bounds.")

    if len(datasets) == 1:
        return datasets[0].sortby("time")

    reference = datasets[0]
    aligned = [
        ds.reindex(lat=reference.lat, lon=reference.lon, method=None)
        for ds in datasets
    ]
    combined = xr.concat(aligned, dim="time").sortby("time")
    combined = combined.sel(time=~combined.get_index("time").duplicated())
    return combined
