from __future__ import annotations

from functools import lru_cache

from backend.database.config import SupabaseSettings, get_supabase_settings

try:
    from supabase import Client, create_client
except ImportError:  # pragma: no cover - handled at runtime by helper
    Client = object  # type: ignore[assignment]
    create_client = None


def supabase_is_configured() -> bool:
    return get_supabase_settings() is not None


def _require_settings() -> SupabaseSettings:
    settings = get_supabase_settings()
    if settings is None:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in your environment."
        )
    return settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    settings = _require_settings()

    if create_client is None:
        raise RuntimeError(
            "The 'supabase' package is not installed. Install dependencies from "
            "backend/algorithms/requirements.txt first."
        )

    return create_client(settings.url, settings.key)
