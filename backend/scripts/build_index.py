"""Embeds every question currently in the database and (re)builds the
Chroma RAG index used for question retrieval and follow-up grounding.

Usage (from the backend/ directory):
    python scripts/build_index.py

Run this after scripts/seed_questions.py, and again any time the bank
changes outside the admin API (which indexes incrementally on its own).
"""

import sys
import time
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal  # noqa: E402
from app.rag.indexer import build_index  # noqa: E402
from app.rag.vector_store import collection_count  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        print("Embedding questions and building the vector index (first run downloads the embedding model, ~130MB)...")
        start = time.time()
        indexed = build_index(db)
        elapsed = time.time() - start
        print(f"Indexed {indexed} questions in {elapsed:.1f}s. Vector store now holds {collection_count()} entries.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
