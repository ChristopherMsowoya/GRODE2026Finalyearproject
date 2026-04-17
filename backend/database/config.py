from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class SupabaseSettings:
    url: str
    key: str
    schema: str = "public"


def get_supabase_settings() -> SupabaseSettings | None:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    schema = os.getenv("SUPABASE_DB_SCHEMA", "public")

    if not url or not key:
        return None

    return SupabaseSettings(url=url, key=key, schema=schema)
