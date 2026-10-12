
import os
import sqlite3
from pathlib import Path

import psycopg
from dotenv import load_dotenv

# Load PostgreSQL credentials from the project-root .env file.
PROJECT_DIR = Path(__file__).resolve().parent
SQLITE_PATH = PROJECT_DIR / "data" / "disaster.db"

load_dotenv(PROJECT_DIR / ".env")

# Parent tables must be migrated before tables with foreign keys.
TABLES = [
    "incidents",
    "resources",
    "shelters",
    "allocations",
    "weather_assessments",
    "approval_requests",
    "response_actions",
]


def main():
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(
            f"SQLite database not found: {SQLITE_PATH}"
        )

    required_env = [
        "DB_HOST", "DB_PORT", "DB_NAME",
        "DB_USER", "DB_PASSWORD"
    ]
    missing = [key for key in required_env if not os.getenv(key)]

    if missing:
        raise RuntimeError(
            "Missing .env settings: " + ", ".join(missing)
        )

    source = sqlite3.connect(SQLITE_PATH)
    source.row_factory = sqlite3.Row

    try:
        with psycopg.connect(
            host=os.environ["DB_HOST"],
            port=os.environ["DB_PORT"],
            dbname=os.environ["DB_NAME"],
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
        ) as target:

            with target.cursor() as cursor:
                print("Starting SQLite -> PostgreSQL migration")
                print(f"Source: {SQLITE_PATH}")
                print()

                for table in TABLES:
                    source_rows = source.execute(
                        f'SELECT * FROM "{table}"'
                    ).fetchall()

                    columns = [
                        item["name"]
                        for item in source.execute(
                            f'PRAGMA table_info("{table}")'
                        ).fetchall()
                    ]

                    if not columns:
                        raise RuntimeError(
                            f"SQLite table not found: {table}"
                        )

                    column_sql = ", ".join(
                        f'"{column}"' for column in columns
                    )
                    placeholders = ", ".join(
                        ["%s"] * len(columns)
                    )

                    sql = (
                        f'INSERT INTO "{table}" ({column_sql}) '
                        f'VALUES ({placeholders}) '
                        f'ON CONFLICT DO NOTHING'
                    )

                    before = cursor.execute(
                        f'SELECT COUNT(*) FROM "{table}"'
                    ).fetchone()[0]

                    inserted = 0

                    for row in source_rows:
                        cursor.execute(
                            sql,
                            tuple(row[column] for column in columns)
                        )
                        if cursor.rowcount == 1:
                            inserted += 1

                    after = cursor.execute(
                        f'SELECT COUNT(*) FROM "{table}"'
                    ).fetchone()[0]

                    print(
                        f"{table}: SQLite={len(source_rows)}, "
                        f"inserted={inserted}, "
                        f"PostgreSQL before={before}, "
                        f"after={after}"
                    )

            # Commit happens when the connection context exits
            # successfully. An exception rolls back the transaction.

        print()
        print("Migration finished successfully.")
        print("Your SQLite database was not modified.")

    finally:
        source.close()


if __name__ == "__main__":
    main()
