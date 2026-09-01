import os

from sqlalchemy.orm import Session

from app.models.question import Question
from app.rag.embeddings import embed_texts
from app.rag.vector_store import upsert_questions

# Kept small deliberately: the embedding runtime plus a batch of documents is
# the peak-memory moment of the whole app, and on a Docker Desktop configured
# with only 1-2GB the container gets OOM-killed (exit 137) here. Raise it via
# INDEX_BATCH_SIZE if you have memory to spare and want a faster build.
BATCH_SIZE = int(os.getenv("INDEX_BATCH_SIZE", "32"))


def build_document(q: Question) -> str:
    """The text we embed — question + tags, so semantic search also picks
    up matches on topic/keyword phrasing, not just the raw question text."""
    parts = [q.question, " ".join(q.topics), " ".join(q.tech_keywords), " ".join(q.roles)]
    return " | ".join(p for p in parts if p)


def build_metadata(q: Question) -> dict:
    return {
        "type": q.type,
        "difficulty": q.difficulty,
        "source_style": q.source_style,
        "roles_csv": ",".join(q.roles),
        "topics_csv": ",".join(q.topics),
        "tech_keywords_csv": ",".join(q.tech_keywords),
    }


def build_index(db: Session, *, only_missing: bool = False) -> int:
    """Embeds every question in SQL and upserts into the Chroma index.
    Called by scripts/build_index.py after seeding, and safe to re-run
    (upsert is idempotent on id)."""
    indexed = 0
    batch: list[Question] = []

    # Streamed rather than .all(): every question now carries several hundred
    # words of cognitive scaffolding, so materialising the whole bank at once is
    # a lot of live objects to hold alongside the embedding runtime.
    for question in db.query(Question).yield_per(BATCH_SIZE):
        batch.append(question)
        if len(batch) < BATCH_SIZE:
            continue
        indexed += _flush(batch)
        batch = []

    if batch:
        indexed += _flush(batch)

    return indexed


def _flush(batch: list[Question]) -> int:
    documents = [build_document(q) for q in batch]
    embeddings = embed_texts(documents)
    upsert_questions(
        ids=[q.id for q in batch],
        embeddings=embeddings,
        documents=documents,
        metadatas=[build_metadata(q) for q in batch],
    )
    return len(batch)
