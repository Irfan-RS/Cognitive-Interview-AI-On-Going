"""Loads every data/question_bank/*.json file into the database.

Usage (from the backend/ directory):
    python scripts/seed_questions.py

Safe to re-run — questions are upserted by id, so editing a JSON file and
re-running just updates the changed rows.
"""

import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.services.admin_question_service import bulk_import  # noqa: E402
import app.models  # noqa: E402,F401


def main() -> None:
    Base.metadata.create_all(bind=engine)

    bank_dir = BACKEND_ROOT / "data" / "question_bank"
    json_files = sorted(bank_dir.glob("*.json"))
    if not json_files:
        print(f"No JSON files found in {bank_dir} — nothing to seed.")
        return

    db = SessionLocal()
    try:
        grand_total_inserted = grand_total_updated = grand_total_skipped = 0

        for path in json_files:
            with open(path, encoding="utf-8") as f:
                items = json.load(f)
            if not isinstance(items, list):
                print(f"  ! {path.name}: expected a JSON array at the top level, skipping file")
                continue

            result = bulk_import(db, items)
            grand_total_inserted += result.inserted
            grand_total_updated += result.updated
            grand_total_skipped += result.skipped_invalid
            print(
                f"  {path.name}: {len(items)} in file -> "
                f"{result.inserted} inserted, {result.updated} updated, {result.skipped_invalid} skipped"
            )

        print()
        print(
            f"Done. Totals: {grand_total_inserted} inserted, {grand_total_updated} updated, "
            f"{grand_total_skipped} skipped across {len(json_files)} file(s)."
        )
        print(f"Question bank now has {result.total_in_bank} questions total.")
        print()
        print("Next step: build the RAG vector index with `python scripts/build_index.py`")
    finally:
        db.close()


if __name__ == "__main__":
    main()
