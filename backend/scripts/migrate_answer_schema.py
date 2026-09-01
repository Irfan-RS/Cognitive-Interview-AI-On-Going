"""One-off, idempotent migration: adds the new multi-dimension scoring
columns to an existing local `answers` table, and drops the old
`rubric_score`/`confidence_score` columns. `Base.metadata.create_all` only
creates missing tables, it never alters an existing one, so this handles the
transition for anyone with a pre-existing local SQLite DB.

The old columns are NOT NULL with no DB-level default (SQLAlchemy's typed
`Mapped[float]` implies nullable=False), so simply no longer writing to them
breaks every insert — they must be dropped, not just left unused. This is
safe here because `backend/storage/` only ever holds local dev/test data.

Usage (from the backend/ directory):
    python scripts/migrate_answer_schema.py
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text  # noqa: E402

from app.db.session import engine  # noqa: E402

NEW_COLUMNS = {
    "dimension_scores": "JSON",
    "overall_score": "FLOAT DEFAULT 0.0",
    "category_scores": "JSON",
}
DROPPED_COLUMNS = ["rubric_score", "confidence_score"]


def main() -> None:
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(answers)"))}
        if not existing:
            print("No 'answers' table found yet — nothing to migrate (it'll be created fresh with the new schema).")
            return

        for column, ddl_type in NEW_COLUMNS.items():
            if column in existing:
                print(f"  {column}: already present, skipping")
                continue
            conn.execute(text(f"ALTER TABLE answers ADD COLUMN {column} {ddl_type}"))
            print(f"  {column}: added")

        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(answers)"))}
        for column in DROPPED_COLUMNS:
            if column not in existing:
                print(f"  {column}: already absent, skipping")
                continue
            conn.execute(text(f"ALTER TABLE answers DROP COLUMN {column}"))
            print(f"  {column}: dropped")

    print("\nMigration complete.")


if __name__ == "__main__":
    main()
