from sqlalchemy.orm import Session

from app.models.question import Question
from app.rag.embeddings import embed_texts
from app.rag.vector_store import upsert_questions

BATCH_SIZE = 128


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
    query = db.query(Question)
    questions = query.all()

    indexed = 0
    for i in range(0, len(questions), BATCH_SIZE):
        batch = questions[i : i + BATCH_SIZE]
        documents = [build_document(q) for q in batch]
        embeddings = embed_texts(documents)
        metadatas = [build_metadata(q) for q in batch]
        ids = [q.id for q in batch]
        upsert_questions(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
        indexed += len(batch)

    return indexed
