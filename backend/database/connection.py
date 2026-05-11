import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(PROJECT_ROOT / "backend" / ".env")


def get_database_url() -> str:
    database_url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Add your Supabase/Postgres connection string "
            "to .env or backend/.env before using database-backed features."
        )

    return database_url


@contextmanager
def get_connection():
    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError(
            "psycopg is not installed. Install backend requirements before using "
            "database-backed features."
        ) from exc

    with psycopg.connect(get_database_url()) as connection:
        yield connection


def fetch_all(query: str, params: tuple | dict | None = None):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            columns = [column.name for column in cursor.description or []]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]


def fetch_one(query: str, params: tuple | dict | None = None):
    rows = fetch_all(query, params)
    return rows[0] if rows else None

