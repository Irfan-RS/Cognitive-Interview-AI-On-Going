from functools import lru_cache

from app.core.config import get_settings

COLLECTION_NAME = "questions"


@lru_cache
def get_collection():
    # Imported lazily for the same reason as fastembed — avoid paying the
    # (real, but not huge) import cost unless RAG is actually touched.
    import chromadb
    from chromadb.config import Settings as ChromaSettings

    settings = get_settings()
    path = str(settings.resolve(settings.chroma_persist_dir))
    client = chromadb.PersistentClient(path=path, settings=ChromaSettings(anonymized_telemetry=False))
    # embedding_function=None: we always pass precomputed embeddings ourselves
    # (via app.rag.embeddings) so Chroma never tries to download its own model.
    return client.get_or_create_collection(name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"})


def upsert_questions(
    ids: list[str], embeddings: list[list[float]], documents: list[str], metadatas: list[dict]
) -> None:
    if not ids:
        return
    get_collection().upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def query_similar(embedding: list[float], n_results: int = 50) -> list[tuple[str, float]]:
    """Returns [(question_id, distance)] ordered by similarity (ascending
    distance = more similar), for the caller to intersect with a
    metadata-filtered candidate set."""
    collection = get_collection()
    if collection.count() == 0:
        return []

    result = collection.query(
        query_embeddings=[embedding],
        n_results=min(n_results, collection.count()),
        include=["distances"],
    )
    ids = result["ids"][0]
    distances = result["distances"][0]
    return list(zip(ids, distances))


def collection_count() -> int:
    return get_collection().count()
