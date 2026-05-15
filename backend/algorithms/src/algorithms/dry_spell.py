# algorithms/dry_spell.py

from utils.timeseries_utils import detect_dry_spells_vectorized

DRY_DAY_THRESHOLD_MM = 1.0
POST_ONSET_WINDOW_DAYS = 20
DRY_SPELL_MIN_LENGTH_DAYS = 5


def detect_dry_spell_lengths(
    rainfall,
    dry_day_threshold=DRY_DAY_THRESHOLD_MM,
):
    """Return consecutive dry-day run lengths where daily rainfall is below threshold."""
    return detect_dry_spells_vectorized(rainfall, dry_day_threshold=dry_day_threshold)


def dry_spell_event_for_season(
    season,
    onset_index=None,
    window_days=POST_ONSET_WINDOW_DAYS,
    min_spell_length=DRY_SPELL_MIN_LENGTH_DAYS,
    dry_day_threshold=DRY_DAY_THRESHOLD_MM,
):
    """Detect whether a season has a post-onset dry spell at grid level."""
    if onset_index is None:
        return {
            "detected": False,
            "max_dry_spell_length": 0,
            "dry_day_count": 0,
            "window_days": window_days,
            "dry_day_threshold_mm": dry_day_threshold,
            "min_spell_length_days": min_spell_length,
        }

    rain = season["rainfall"]
    diagnostic_window = rain[onset_index:onset_index + window_days]
    dry_spell_lengths = detect_dry_spell_lengths(diagnostic_window, dry_day_threshold)
    max_length = max(dry_spell_lengths, default=0)

    return {
        "detected": max_length >= min_spell_length,
        "max_dry_spell_length": int(max_length),
        "dry_day_count": int(sum(dry_spell_lengths)),
        "window_days": window_days,
        "dry_day_threshold_mm": dry_day_threshold,
        "min_spell_length_days": min_spell_length,
    }


def calculate_dry_spell_probability(
    seasons,
    onset_indices,
    window_days=POST_ONSET_WINDOW_DAYS,
    min_spell_length=DRY_SPELL_MIN_LENGTH_DAYS,
    dry_day_threshold=DRY_DAY_THRESHOLD_MM,
):
    dry_spell_count = 0

    for i, season in enumerate(seasons):
        event = dry_spell_event_for_season(
            season,
            onset_indices[i],
            window_days=window_days,
            min_spell_length=min_spell_length,
            dry_day_threshold=dry_day_threshold,
        )

        if event["detected"]:
            dry_spell_count += 1

    return dry_spell_count / len(seasons) if seasons else 0


def calculate_stress_fast(seasons, onset_indices):
    """Backward-compatible alias for the dry spell diagnostic."""
    return calculate_dry_spell_probability(seasons, onset_indices)
