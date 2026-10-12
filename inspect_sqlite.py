
import sqlite3
from pathlib import Path

db_path = Path("data/disaster.db")

if not db_path.exists():
    raise FileNotFoundError(f"SQLite database not found: {db_path}")

connection = sqlite3.connect(db_path)

try:
    integrity = connection.execute(
        "PRAGMA integrity_check"
    ).fetchone()[0]
    print("SQLite integrity check:", integrity)

    tables = connection.execute("""
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    """).fetchall()

    print("\nExisting tables and record counts:")

    for (table_name,) in tables:
        # Table names come from SQLite's own table list.
        quoted_name = '"' + table_name.replace('"', '""') + '"'
        count = connection.execute(
            f"SELECT COUNT(*) FROM {quoted_name}"
        ).fetchone()[0]
        print(f"{table_name}: {count} records")

finally:
    connection.close()
