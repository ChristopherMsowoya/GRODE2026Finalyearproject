#!/usr/bin/env python3
import os
import sys

print(f"Python: {sys.executable} {sys.version.splitlines()[0]}")
print(f"DATABASE_URL set: {'DATABASE_URL' in os.environ}")

def try_backend_connection():
    try:
        from backend.database.connection import get_connection
    except Exception as e:
        print("backend.database.connection import failed:", e)
        return False

    try:
        # `get_connection()` is a context manager; use `with` to obtain real connection
        with get_connection() as conn:
            # exercise a trivial query
            with conn.cursor() as cur:
                cur.execute("select 1")
                _ = cur.fetchone()
        print("CONNECTED using backend.database.connection.get_connection()")
        return True
    except Exception as e:
        print("backend.get_connection() failed:", type(e).__name__, e)
        return False


def try_psycopg2_direct():
    try:
        import psycopg2
    except Exception as e:
        print("psycopg2 import failed:", e)
        return False

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set in environment")
        return False

    try:
        conn = psycopg2.connect(url)
        conn.close()
        print("CONNECTED using psycopg2.connect(DATABASE_URL)")
        return True
    except Exception as e:
        print("psycopg2 connect failed:", type(e).__name__, e)
        return False


if __name__ == '__main__':
    ok = try_backend_connection()
    if not ok:
        ok = try_psycopg2_direct()

    if not ok:
        print("ALL CONNECTION ATTEMPTS FAILED")
        sys.exit(2)
    else:
        print("SUCCESS: at least one connection method worked")
