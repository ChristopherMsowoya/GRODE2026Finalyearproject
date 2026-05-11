from pathlib import Path

from backend.database.connection import get_connection

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def apply_migrations():
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))

    if not migration_files:
        print(f"No migration files found in {MIGRATIONS_DIR}")
        return

    with get_connection() as connection:
        with connection.cursor() as cursor:
            for migration_file in migration_files:
                print(f"Applying {migration_file.name}...")
                cursor.execute(migration_file.read_text(encoding="utf-8"))

        connection.commit()

    print("Database migrations applied successfully.")


if __name__ == "__main__":
    apply_migrations()

