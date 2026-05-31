# algorithms/false_onset.py

import numpy as np

from utils.timeseries_utils import detect_dry_spells_vectorized

TRIGGER_RAINFALL_MM = 25
TRIGGER_WINDOW_DAYS = 3
PERSISTENCE_WINDOW_DAYS = 20
FAILURE_DRY_SPELL_DAYS = 10


def false_onset_event_for_season(
    season,
    onset_index=None,
    trigger_threshold=TRIGGER_RAINFALL_MM,
    trigger_window=TRIGGER_WINDOW_DAYS,
    persistence_window=PERSISTENCE_WINDOW_DAYS,
    failure_dry_spell_days=FAILURE_DRY_SPELL_DAYS,
):
    """Detect failed rainfall triggers before the valid onset.

    A false onset is an early trigger that reaches the 3-day rainfall
    threshold but fails persistence because a 10+ day dry spell occurs in
    the following 20 days. If no valid onset exists, every failed trigger in
    the rainy season is eligible.
    """
    rain = np.asarray(season["rainfall"], dtype=float)
    if rain.size < trigger_window:
        return {
            "detected": False,
            "false_trigger_count": 0,
            "first_trigger_index": None,
            "first_trigger_date": None,
            "first_trigger_rainfall_mm": 0.0,
            "max_failure_dry_spell_days": 0,
        }

    rolling_sum = np.convolve(rain, np.ones(trigger_window, dtype=float), mode="valid")
    candidate_indices = np.where(rolling_sum >= trigger_threshold)[0] + (trigger_window - 1)

    false_triggers = []
    dates = season.get("dates") or []

    for index in candidate_indices:
        if onset_index is not None and index >= onset_index:
            continue

        next_window = rain[index:index + persistence_window]
        if next_window.size < persistence_window:
            continue

        dry_spells = detect_dry_spells_vectorized(next_window)
        max_dry_spell = max(dry_spells, default=0)

        if max_dry_spell >= failure_dry_spell_days:
            false_triggers.append({
                "index": int(index),
                "date": dates[index] if index < len(dates) else None,
                "rainfall_3day_total": float(rolling_sum[index - (trigger_window - 1)]),
                "max_failure_dry_spell_days": int(max_dry_spell),
            })

    first = false_triggers[0] if false_triggers else {}
    return {
        "detected": bool(false_triggers),
        "false_trigger_count": len(false_triggers),
        "first_trigger_index": first.get("index"),
        "first_trigger_date": first.get("date"),
        "first_trigger_rainfall_mm": first.get("rainfall_3day_total", 0.0),
        "max_failure_dry_spell_days": max(
            (trigger["max_failure_dry_spell_days"] for trigger in false_triggers),
            default=0,
        ),
    }


def calculate_false_onset_fast(seasons, onset_indices=None):
    return calculate_false_onset_probability(seasons, onset_indices)


def calculate_false_onset_probability(
    seasons,
    onset_indices=None,
    trigger_threshold=TRIGGER_RAINFALL_MM,
    trigger_window=TRIGGER_WINDOW_DAYS,
    persistence_window=PERSISTENCE_WINDOW_DAYS,
    failure_dry_spell_days=FAILURE_DRY_SPELL_DAYS,
):
    false_count = 0

    for i, season in enumerate(seasons):
        onset_index = None if onset_indices is None else onset_indices[i]
        event = false_onset_event_for_season(
            season,
            onset_index,
            trigger_threshold=trigger_threshold,
            trigger_window=trigger_window,
            persistence_window=persistence_window,
            failure_dry_spell_days=failure_dry_spell_days,
        )

        if event["detected"]:
            false_count += 1

    return false_count / len(seasons) if seasons else 0
