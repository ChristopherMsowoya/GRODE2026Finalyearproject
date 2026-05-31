from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "algorithm_config.json"

DEFAULT_ALGORITHM_CONFIG: dict[str, Any] = {
    "season_start_month": 11,
    "season_end_month": 4,
    "enabled_season_years": [],
    "onset_trigger_mm": 25.0,
    "onset_trigger_window_days": 3,
    "persistence_window_days": 20,
    "persistence_dry_spell_days": 10,
    "dry_day_threshold_mm": 1.0,
    "dry_spell_threshold_days": [5, 7, 9],
}


def load_algorithm_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        save_algorithm_config(DEFAULT_ALGORITHM_CONFIG)
        return dict(DEFAULT_ALGORITHM_CONFIG)

    try:
        with CONFIG_PATH.open("r", encoding="utf-8") as config_file:
            stored = json.load(config_file)
    except Exception:
        stored = {}

    return normalize_algorithm_config({**DEFAULT_ALGORITHM_CONFIG, **stored})


def save_algorithm_config(config: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_algorithm_config({**DEFAULT_ALGORITHM_CONFIG, **config})
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CONFIG_PATH.open("w", encoding="utf-8") as config_file:
        json.dump(normalized, config_file, indent=2)
    return normalized


def normalize_algorithm_config(config: dict[str, Any]) -> dict[str, Any]:
    return {
        "season_start_month": clamp_int(config.get("season_start_month"), 1, 12, 11),
        "season_end_month": clamp_int(config.get("season_end_month"), 1, 12, 4),
        "enabled_season_years": sorted({
            int(year)
            for year in config.get("enabled_season_years", [])
            if str(year).isdigit()
        }),
        "onset_trigger_mm": clamp_float(config.get("onset_trigger_mm"), 1.0, 500.0, 25.0),
        "onset_trigger_window_days": clamp_int(config.get("onset_trigger_window_days"), 1, 15, 3),
        "persistence_window_days": clamp_int(config.get("persistence_window_days"), 1, 90, 20),
        "persistence_dry_spell_days": clamp_int(config.get("persistence_dry_spell_days"), 1, 60, 10),
        "dry_day_threshold_mm": clamp_float(config.get("dry_day_threshold_mm"), 0.0, 20.0, 1.0),
        "dry_spell_threshold_days": sorted({
            clamp_int(value, 1, 60, 5)
            for value in config.get("dry_spell_threshold_days", [5, 7, 9])
        }),
    }


def clamp_int(value: Any, minimum: int, maximum: int, fallback: int) -> int:
    try:
        number = int(value)
    except Exception:
        number = fallback
    return max(minimum, min(maximum, number))


def clamp_float(value: Any, minimum: float, maximum: float, fallback: float) -> float:
    try:
        number = float(value)
    except Exception:
        number = fallback
    return max(minimum, min(maximum, number))
