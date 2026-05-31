from __future__ import annotations

import argparse
from pathlib import Path
from urllib.request import urlretrieve


BASE_URL = "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/netcdf/p05"
PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAW_DATA_DIR = PROJECT_ROOT / "backend" / "algorithms" / "data" / "raw"


def build_filename(year: int) -> str:
    return f"chirps-v2.0.{year}.days_p05.nc"


def build_url(year: int) -> str:
    return f"{BASE_URL}/{build_filename(year)}"


def download_year(year: int, output_dir: Path, overwrite: bool = False) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    destination = output_dir / build_filename(year)

    if destination.exists() and not overwrite:
        print(f"Skipping {year}: {destination.name} already exists")
        return destination

    url = build_url(year)
    print(f"Downloading {url}")
    urlretrieve(url, destination)
    print(f"Saved to {destination}")
    return destination


def parse_args():
    parser = argparse.ArgumentParser(
        description="Download official 0.05-degree CHIRPS daily NetCDF files."
    )
    parser.add_argument(
        "years",
        nargs="+",
        type=int,
        help="Years to download, for example: 2019 2020 2021",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=RAW_DATA_DIR,
        help="Destination folder for downloaded NetCDF files.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Redownload files even if they already exist.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    for year in args.years:
        if year < 1981:
            raise ValueError("CHIRPS starts at 1981. Choose years from 1981 onward.")
        download_year(year, args.output_dir, overwrite=args.overwrite)


if __name__ == "__main__":
    main()
