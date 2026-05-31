# result_schema.py


def build_result(
    grid_id,
    lat,
    lon,
    first_onset_date,
    latest_onset_date,
    seasons_analyzed,
    seasons_with_detected_onset,
    false_prob,
    stress_prob,
    season_diagnostics=None,
    onset_timeline=None,
):
    max_risk = max(false_prob, stress_prob)
    onset_probability = (
        seasons_with_detected_onset / seasons_analyzed
        if seasons_analyzed
        else 0
    )

    return {
        "grid_id": grid_id,
        "latitude": lat,
        "longitude": lon,
        "seasons_analyzed": seasons_analyzed,
        "seasons_with_detected_onset": seasons_with_detected_onset,
        "first_detected_onset_date": stringify_date(first_onset_date),
        "latest_detected_onset_date": stringify_date(latest_onset_date),
        "onset_probability": round(onset_probability, 3),
        "false_onset_probability": round(false_prob, 3),
        "dry_spell_probability": round(stress_prob, 3),
        "season_diagnostics": season_diagnostics or [],
        "onset_timeline": onset_timeline or {},
        "overall_risk_level": classify_risk(max_risk),
        "false_onset_interpretation": describe_probability(
            false_prob,
            seasons_analyzed,
            "onset was followed by a 10+ day dry spell"
        ),
        "dry_spell_interpretation": describe_probability(
            stress_prob,
            seasons_analyzed,
            "onset was followed by a 5+ day dry spell with daily rainfall below 1mm"
        ),
    }


def stringify_date(value):
    return None if value is None else str(value)


def describe_probability(prob, seasons_analyzed, description):
    if seasons_analyzed <= 1:
        if prob == 0:
            return f"No cases where {description} in the available season."
        return f"The available season had a case where {description}."

    percentage = round(prob * 100, 1)
    return f"{percentage}% of analyzed seasons had cases where {description}."


def classify_risk(prob):
    if prob <= 0.30:
        return "Low"
    elif prob <= 0.60:
        return "Medium"
    else:
        return "High"
