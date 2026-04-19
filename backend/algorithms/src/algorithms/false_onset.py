# algorithms/false_onset.py

from utils.timeseries_utils import detect_dry_spells_vectorized


import numpy as np

def calculate_false_onset_fast(seasons, onset_indices=None):
    false_count = 0

    for idx, season in enumerate(seasons):
        # We don't use the successful onset_indices because by definition,
        # successful onsets have no false onset characteristics.
        # Instead, we look for the first CANDIDATE onset in the season.
        rain = np.asarray(season["rainfall"], dtype=float)
        
        if rain.size < 20:
            continue
            
        rolling_sum = np.convolve(rain, np.ones(3, dtype=float), mode="valid")
        candidates = np.where(rolling_sum >= 25)[0] + 2
        
        if len(candidates) == 0:
            continue
            
        # Check the VERY FIRST candidate onset
        first_candidate_index = candidates[0]
        
        next_30 = rain[first_candidate_index:first_candidate_index + 30]
        
        if next_30.size < 10:
            continue

        dry_spells = detect_dry_spells_vectorized(next_30)

        # A false onset occurs if a dry spell of 7+ days happens shortly after initial rains
        if any(spell >= 7 for spell in dry_spells):
            false_count += 1

    return false_count / len(seasons) if seasons else 0
