# utils/timeseries_utils.py

import pandas as pd


def detect_dry_spells_vectorized(rainfall, dry_day_threshold=1.0):
    dry_spells = []
    current_spell = 0

    for value in rainfall:
        rain = float(value)

        if rain < dry_day_threshold:
            current_spell += 1
            continue

        if current_spell:
            dry_spells.append(current_spell)
            current_spell = 0

    if current_spell:
        dry_spells.append(current_spell)

    return dry_spells


def split_by_year(dates, rainfall):
    df = pd.DataFrame({
        "date": pd.to_datetime(dates),
        "rain": rainfall
    })

    df["year"] = df["date"].dt.year

    seasons = []

    for year, group in df.groupby("year"):
        seasons.append({
            "dates": list(group["date"]),
            "rainfall": list(group["rain"])
        })

    return seasons
