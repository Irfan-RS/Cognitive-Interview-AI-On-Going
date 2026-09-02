"""Idempotent schema migration for the local SQLite DB.

`Base.metadata.create_all` only creates MISSING tables — it never alters an
existing one — so new columns on `answers`/`questions` need adding explicitly
for anyone with a pre-existing database.

Old columns that are now NOT NULL with no default are dropped rather than left
in place: simply no longer writing to them would break every insert. That's safe
here because backend/storage/ only ever holds local dev data.

Usage (from the backend/ directory):
    python scripts/migrate_answer_schema.py
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text  # noqa: E402

from app.db.session import engine  # noqa: E402

NEW_COLUMNS: dict[str, dict[str, str]] = {
    "answers": {
        "dimension_scores": "JSON",
        "overall_score": "FLOAT DEFAULT 0.0",
        "category_scores": "JSON",
        "concepts_demonstrated": "JSON",
        "strengths": "JSON",
        "weaknesses": "JSON",
        "reasoning_analysis": "JSON",
        "mistakes": "JSON",
        "hint_required": "BOOLEAN DEFAULT 0",
        "follow_up_required": "BOOLEAN DEFAULT 0",
        "suggested_follow_up": "TEXT DEFAULT ''",
        "improvement_feedback": "TEXT DEFAULT ''",
        "recommended_next_action": "TEXT DEFAULT ''",
    },
    "questions": {
        "concept": "VARCHAR DEFAULT ''",
        "sub_concept": "VARCHAR DEFAULT ''",
        "expected_reasoning": "TEXT DEFAULT ''",
        "common_mistakes": "JSON",
        "progressive_hints": "JSON",
        "learning_objective": "TEXT DEFAULT ''",
    },
    "interview_sessions": {
        "resume_projects": "JSON",
    },
    "session_questions": {
        "source_project": "JSON",
    },
}

DROPPED_COLUMNS: dict[str, list[str]] = {
    "answers": ["rubric_score", "confidence_score", "answer_framework", "improvement_tips"],
}


def main() -> None:
    with engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            if not existing:
                print(f"{table}: table not created yet — skipping (it'll be built with the new schema).")
                continue

            print(f"{table}:")
            for column, ddl_type in columns.items():
                if column in existing:
                    print(f"  {column}: already present")
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
                print(f"  {column}: added")

            for column in DROPPED_COLUMNS.get(table, []):
                if column not in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))
                print(f"  {column}: dropped")

    print("\nMigration complete.")


if __name__ == "__main__":
    main()
