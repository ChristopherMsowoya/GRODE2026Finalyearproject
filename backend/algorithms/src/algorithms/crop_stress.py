# algorithms/crop_stress.py

from utils.timeseries_utils import detect_dry_spells_vectorized


def calculate_stress_fast(seasons, onset_indices):
    stress_count = 0

    for i, season in enumerate(seasons):
        onset_index = onset_indices[i]
        if onset_index is None:
            continue

        rain = season["rainfall"]
        next_20 = rain[onset_index:onset_index + 20]

        dry_spells = detect_dry_spells_vectorized(next_20)

        if any(spell >= 5 for spell in dry_spells):
            stress_count += 1

    return stress_count / len(seasons) if seasons else 0
