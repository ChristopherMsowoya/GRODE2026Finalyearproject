# processing/grid_extractor.py

DEFAULT_BOUNDS = {
    "malawi": {
        "lat": (-17.5, -9.0),
        "lon": (32.5, 35.95),
    }
}


def subset_dataset(ds, bounds=None):
    if not bounds:
        return ds

    lat_min, lat_max = sorted(bounds["lat"])
    lon_min, lon_max = sorted(bounds["lon"])

    return ds.sel(
        lat=slice(lat_min, lat_max),
        lon=slice(lon_min, lon_max)
    )


def iter_grids_fast(ds):
    rainfall = ds["precip"].transpose("lat", "lon", "time").values
    dates = ds["time"].values
    latitudes = ds["lat"].values
    longitudes = ds["lon"].values

    for lat_index, lat in enumerate(latitudes):
        for lon_index, lon in enumerate(longitudes):
            cell_rainfall = rainfall[lat_index, lon_index]

            if cell_rainfall.size == 0:
                continue

            yield {
                "lat": float(lat),
                "lon": float(lon),
                "rainfall": cell_rainfall,
                "dates": dates
            }
