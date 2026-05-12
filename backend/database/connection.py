import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from urllib.parse import urlparse, parse_qs, unquote
import socket

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

    url = get_database_url()

    # Try a normal connect first (don't wrap the yield in the same try/except,
    # so exceptions thrown from the caller's with-block aren't intercepted here).
    try:
        conn = psycopg.connect(url)
    except Exception as exc:
        err = exc
    else:
        with conn as connection:
            yield connection
            return

    # Fallback: if the URL references a Supabase pooler host, attempt connecting
    # to the pooler's IP address while setting the SNI/host to the tenant DB host.
    try:
        parsed = urlparse(url)
        host = parsed.hostname
        port = parsed.port or 5432
        user = parsed.username and unquote(parsed.username)
        password = parsed.password and unquote(parsed.password)
        dbname = parsed.path.lstrip('/') if parsed.path else None
        qs = parse_qs(parsed.query)
        sslmode = qs.get('sslmode', [None])[0]

        if host and host.endswith('pooler.supabase.com') and user and '.' in user:
            # derive tenant host from username suffix: postgres.<project_ref>
            project_ref = user.split('.', 1)[1]
            tenant_host = f"db.{project_ref}.supabase.co"

            # resolve pooler IP (prefer IPv4)
            infos = socket.getaddrinfo(host, port, family=socket.AF_INET, type=socket.SOCK_STREAM)
            pooler_ip = infos[0][4][0]

            conn_params = {
                'host': tenant_host,     # used for SNI/virtual host
                'hostaddr': pooler_ip,   # actual IP to connect to
                'port': port,
                'user': user,
                'password': password,
                'dbname': dbname,
            }
            if sslmode:
                conn_params['sslmode'] = sslmode

            conn2 = psycopg.connect(**conn_params)
            with conn2 as connection:
                yield connection
                return
    except Exception:
        # fall through to raise original error
        pass

    # If we reach here, re-raise the original connection error for visibility
    raise err


def fetch_all(query: str, params: tuple | dict | None = None):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            columns = [column.name for column in cursor.description or []]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]


def fetch_one(query: str, params: tuple | dict | None = None):
    rows = fetch_all(query, params)
    return rows[0] if rows else None

