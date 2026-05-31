# algorithms/onset.py

import numpy as np
from utils.timeseries_utils import detect_dry_spells_vectorized


def detect_onset_details_fast(
    rainfall,
    dates,
    trigger_threshold=25,
    trigger_window=3,
    persistence_window=20,
    failure_dry_spell_days=10,
    dry_day_threshold=1.0,
):
    rain = np.asarray(rainfall, dtype=float)
    date_values = np.asarray(dates)

    if rain.size < max(trigger_window, persistence_window):
        return None, None

    rolling_sum = np.convolve(rain, np.ones(trigger_window, dtype=float), mode="valid")
    candidates = np.where(rolling_sum >= trigger_threshold)[0] + (trigger_window - 1)

    for index in candidates:
        next_window = rain[index:index + persistence_window]

        if next_window.size < persistence_window:
            continue

        dry_spells = detect_dry_spells_vectorized(next_window, dry_day_threshold=dry_day_threshold)

        if any(spell >= failure_dry_spell_days for spell in dry_spells):
            continue

        return date_values[index], int(index)

    return None, None


def detect_onset_fast(rainfall, dates, **kwargs):
    onset_date, _ = detect_onset_details_fast(rainfall, dates, **kwargs)
    return onset_date
