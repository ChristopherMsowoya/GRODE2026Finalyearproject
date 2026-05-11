#!/usr/bin/env python3
from pathlib import Path
import sys

from backend.database.connection import get_connection


def run(sql_path: str | None = None):
    repo_root = Path(__file__).resolve().parents[3]
    default = repo_root / "backend" / "database" / "migrations" / "001_phase_i_foundation.sql"
    p = Path(sql_path) if sql_path else default
    if not p.exists():
        raise FileNotFoundError(f"Migration file not found: {p}")

    sql = p.read_text()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()

    print(f"Applied migration: {p}")


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else None
    run(path)
