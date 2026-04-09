# algorithms/onset.py

import numpy as np
from utils.timeseries_utils import detect_dry_spells_vectorized


def detect_onset_details_fast(rainfall, dates):
    rain = np.asarray(rainfall, dtype=float)
    date_values = np.asarray(dates)

    if rain.size < 20:
        return None, None

    rolling_sum = np.convolve(rain, np.ones(3, dtype=float), mode="valid")
    candidates = np.where(rolling_sum >= 25)[0] + 2

    for index in candidates:
        next_20 = rain[index:index + 20]

        if next_20.size < 20:
            continue

        dry_spells = detect_dry_spells_vectorized(next_20)

        if any(spell >= 10 for spell in dry_spells):
            continue

        return date_values[index], int(index)

    return None, None


def detect_onset_fast(rainfall, dates):
    onset_date, _ = detect_onset_details_fast(rainfall, dates)
    return onset_date
