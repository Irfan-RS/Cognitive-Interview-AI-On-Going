"""Quick, dependency-light sanity check that doesn't need Ollama/Google
credentials running: creates the schema, inserts one fake question via the
same admin_question_service path the seed script uses, and confirms it
round-trips through the repository layer.

Usage (from the backend/ directory):
    python scripts/smoke_test.py
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.repositories import question_repo  # noqa: E402
from app.services.admin_question_service import bulk_import  # noqa: E402
import app.models  # noqa: E402,F401

FAKE_QUESTION = {
    "id": "smoke-test-0001",
    "question": "What is the time complexity of binary search?",
    "type": "theory",
    "difficulty": 1,
    "roles": ["general_sde"],
    "topics": ["binary-search"],
    "tech_keywords": ["algorithms"],
    "companies_common": [],
    "source_style": "common-interview",
    "reference_solution": {
        "key_points": ["O(log n)", "requires a sorted array"],
        "sample_answer": "Binary search runs in O(log n) time because it halves the search space each step.",
    },
    "follow_up_hint": "ask about implementing it recursively vs iteratively",
}


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        result = bulk_import(db, [FAKE_QUESTION])
        print(f"bulk_import result: {result}")

        fetched = question_repo.get_by_id(db, "smoke-test-0001")
        assert fetched is not None, "round-trip failed: question not found after insert"
        assert fetched.key_points == ["O(log n)", "requires a sorted array"]
        print(f"round-trip OK: {fetched.id} -> {fetched.question!r}")

        print("\nSMOKE TEST PASSED — DB layer, repositories, and schemas all wired correctly.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
