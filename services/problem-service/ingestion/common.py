import os

import psycopg2

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://algovision:algovision@localhost:5432/algovision"
)


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def insert_problem(conn, **fields):
    """Insert a row into problems, skipping if a problem with the same title
    already exists (ingestion scripts are re-run to pick up new upstream
    content, not to duplicate rows already pulled in)."""
    columns = list(fields.keys())
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM problems WHERE title = %s", (fields["title"],))
        if cur.fetchone():
            return False
        placeholders = ", ".join(["%s"] * len(columns))
        cur.execute(
            f"INSERT INTO problems ({', '.join(columns)}) VALUES ({placeholders})",
            [fields[c] for c in columns],
        )
    return True
