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


def split_by_rainy_season(dates, rainfall, start_month=11, end_month=4):
    """Split daily rainfall into Nov-Apr rainy seasons.

    The season year is the year in which the rainy season starts, e.g.
    November 2022 through April 2023 is season_year=2022.
    """
    df = pd.DataFrame({
        "date": pd.to_datetime(dates),
        "rain": rainfall
    })

    rainy_months = list(range(start_month, 13)) + list(range(1, end_month + 1))
    df = df[df["date"].dt.month.isin(rainy_months)].copy()
    if df.empty:
        return []

    df["season_year"] = df["date"].dt.year
    df.loc[df["date"].dt.month <= end_month, "season_year"] -= 1

    seasons = []
    for season_year, group in df.groupby("season_year"):
        group = group.sort_values("date")
        seasons.append({
            "season_year": int(season_year),
            "season": f"{int(season_year)}-{str(int(season_year) + 1)[-2:]}",
            "dates": list(group["date"]),
            "rainfall": list(group["rain"])
        })

    return seasons
