# algorithms/false_onset.py

from utils.timeseries_utils import detect_dry_spells_vectorized


def calculate_false_onset_fast(seasons, onset_indices=None):
    false_count = 0

    for i, season in enumerate(seasons):
        rain = season["rainfall"]
        onset_index = None if onset_indices is None else onset_indices[i]

        if onset_index is None:
            continue

        next_20 = rain[onset_index:onset_index + 20]

        dry_spells = detect_dry_spells_vectorized(next_20)

        if any(spell >= 10 for spell in dry_spells):
            false_count += 1

    return false_count / len(seasons) if seasons else 0
