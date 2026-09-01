from app.core.config import get_settings


def next_difficulty(current: int, relevance_score: float) -> int:
    """Rule-based adaptive difficulty: a strong answer (well over the
    passing bar) nudges the next question harder; a weak one eases it.
    Deliberately simple and explainable rather than another LLM call —
    this runs on every single answer and should be instant and free."""
    settings = get_settings()

    if relevance_score >= 75:
        new_difficulty = current + 1
    elif relevance_score < 40:
        new_difficulty = current - 1
    else:
        new_difficulty = current

    return max(settings.difficulty_min, min(settings.difficulty_max, new_difficulty))
