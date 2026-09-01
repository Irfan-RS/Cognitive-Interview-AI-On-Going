from functools import lru_cache

from app.core.config import get_settings


@lru_cache
def _model():
    # Imported lazily: fastembed loads an ONNX model + onnxruntime, a real
    # but modest cost we don't want to pay unless RAG is actually used.
    from fastembed import TextEmbedding

    settings = get_settings()
    return TextEmbedding(model_name=settings.embedding_model)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """CPU-friendly embeddings via fastembed (ONNX runtime, no torch) —
    picked specifically to run comfortably on 8GB RAM without a discrete
    GPU requirement. BAAI/bge-small-en-v1.5 is ~130MB and fast on CPU."""
    return [vec.tolist() for vec in _model().embed(texts)]


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]
