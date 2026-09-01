import random

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.question import Question
from app.rag.embeddings import embed_text
from app.rag.vector_store import query_similar

SEMANTIC_POOL_SIZE = 100
# When no candidate matches the active track's tag at all (a genuinely generic
# role like "Software Engineer", or resume keywords that hit nothing), trust
# the embedding model's similarity ranking over just the closest few hits —
# scoring the full 100-candidate pool would let difficulty-fit alone promote
# something semantically unrelated.
SEMANTIC_FALLBACK_TOP_K = 10
TOP_K_CHOICES = 3  # pick randomly among the top-K scored candidates, for variety across sessions
MIN_PARTIAL_MATCH_LEN = 3  # below this, substring matching false-positives too easily (e.g. "ml" inside "html")

# Ranking weights, applied WITHIN whichever pool is active (see select_question):
# semantic similarity plus difficulty fit always contribute; the track's own
# tag-relevance term is included too, but since the pool has already been
# hard-filtered to tag-matching candidates whenever any exist, it mostly acts
# as a tie-breaker there — its real job is ranking the ungated fallback pool
# when no candidate matches the tag at all.
W_SEMANTIC = 0.40
W_ROLE = 0.20
W_TOPIC = 0.20
W_SKILL = 0.10
W_DIFFICULTY = 0.10


def _track_query_text(track: str, role: str | None, resume_keywords: list[str], topic: str | None) -> str:
    if track == "role":
        return f"Interview questions commonly asked for a {role} software engineering role"
    if track == "resume":
        return "Interview questions relevant to a resume mentioning: " + ", ".join(resume_keywords)
    return f"Interview questions about the topic: {topic}"


def _normalize_tag(s: str) -> set[str]:
    """Splits a tag/topic into whole-word tokens, treating hyphens/underscores as
    word separators. Word-level (not raw substring) comparison matters here: a
    naive substring check would match a 'java' tag against a 'javascript' query,
    since 'java' literally IS a substring of 'javascript'."""
    return set(s.lower().replace("-", " ").replace("_", " ").split())


def _squash(s: str) -> str:
    """Strips all separators so 'Full Stack' and 'fullstack' compare equal —
    tags are stored as single compound words (fullstack, general_sde) but
    users naturally type them as separate words."""
    return "".join(s.lower().replace("-", "").replace("_", "").split())


def _tags_overlap(needle_words: set[str], tag: str, needle_squashed: str = "") -> bool:
    tag_words = _normalize_tag(tag)
    if not tag_words:
        return False
    # Whole-word containment either direction: a one-word tag like "javascript"
    # should still match a multi-word query like "javascript closures", but
    # "java" must not match just because it's a prefix of "javascript".
    if tag_words <= needle_words or needle_words <= tag_words:
        return True
    if not needle_squashed or len(needle_squashed) < MIN_PARTIAL_MATCH_LEN:
        return False
    # Partial/prefix typing — "back" or "full" for "backend"/"fullstack" — but
    # guarded by a minimum length so short abbreviations (e.g. "ml") can't
    # accidentally substring-match inside an unrelated longer tag ("html").
    tag_squashed = _squash(tag)
    if len(tag_squashed) < MIN_PARTIAL_MATCH_LEN:
        return False
    return tag_squashed in needle_squashed or needle_squashed in tag_squashed


def _any_tag_match(needle: str, tags: list[str]) -> bool:
    needle_words = _normalize_tag(needle)
    needle_squashed = _squash(needle)
    return any(_tags_overlap(needle_words, tag, needle_squashed) for tag in tags)


def _role_relevance(q: Question, role: str | None) -> float:
    return 1.0 if role and _any_tag_match(role, q.roles) else 0.0


def _topic_relevance(q: Question, topic: str | None) -> float:
    if not topic:
        return 0.0
    return 1.0 if (_any_tag_match(topic, q.topics) or _any_tag_match(topic, q.tech_keywords)) else 0.0


def _skill_relevance(q: Question, resume_keywords: list[str]) -> float:
    """Fraction of the candidate's resume keywords this question actually
    speaks to — a question matching 3 of 4 resume skills should outrank one
    matching only 1, not just tie at a flat "resume track" bonus."""
    if not resume_keywords:
        return 0.0
    hits = sum(1 for kw in resume_keywords if _any_tag_match(kw, q.tech_keywords))
    return hits / len(resume_keywords)


def _track_relevance(q: Question, track: str, role: str | None, resume_keywords: list[str], topic: str | None) -> float:
    if track == "role":
        return _role_relevance(q, role)
    if track == "topic":
        return _topic_relevance(q, topic)
    if track == "resume":
        return _skill_relevance(q, resume_keywords)
    return 0.0


def _difficulty_relevance(q: Question, target_difficulty: int) -> float:
    settings = get_settings()
    span = max(1, settings.difficulty_max - settings.difficulty_min)
    return 1.0 - abs(q.difficulty - target_difficulty) / span


def _score_candidate(
    q: Question,
    *,
    track: str,
    role: str | None,
    resume_keywords: list[str],
    topic: str | None,
    target_difficulty: int,
    semantic_score: float | None,
) -> float:
    signals: list[tuple[float, float]] = []
    if semantic_score is not None:
        signals.append((W_SEMANTIC, semantic_score))
    track_weight = {"role": W_ROLE, "topic": W_TOPIC, "resume": W_SKILL}.get(track)
    if track_weight:
        signals.append((track_weight, _track_relevance(q, track, role, resume_keywords, topic)))
    signals.append((W_DIFFICULTY, _difficulty_relevance(q, target_difficulty)))

    total_weight = sum(w for w, _ in signals) or 1.0
    return sum(w * s for w, s in signals) / total_weight


def _score_and_pick(candidates_with_distance, *, track, role, resume_keywords, topic, target_difficulty) -> Question:
    distances = [dist for _, dist in candidates_with_distance]
    min_d, max_d = min(distances), max(distances)
    span = max(max_d - min_d, 1e-6)

    scored = [
        (
            _score_candidate(
                q,
                track=track,
                role=role,
                resume_keywords=resume_keywords,
                topic=topic,
                target_difficulty=target_difficulty,
                semantic_score=1 - (dist - min_d) / span,
            ),
            q,
        )
        for q, dist in candidates_with_distance
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    top = scored[:TOP_K_CHOICES]
    return random.choice(top)[1]


def select_question(
    db: Session,
    *,
    track: str,
    role: str | None,
    resume_keywords: list[str],
    topic: str | None,
    target_difficulty: int,
    exclude_ids: set[str],
) -> Question | None:
    """RAG-driven question selection. Tag relevance (role/topic/skill) hard-
    filters the semantic candidate pool whenever ANY candidate matches it —
    typing "back" for a backend question must reliably win, not just nudge
    the odds — and a weighted score (semantic similarity + difficulty fit,
    spec section 11's "ranking mechanism") then picks among that filtered
    pool instead of a crude difficulty-sort-then-random tie-break. Only when
    NOTHING matches the tag at all (a genuinely generic role, or resume
    keywords that hit no skill) does ranking fall back to the full semantic
    pool with no tag filter. Falls back further to scoring the whole bank
    (minus semantic similarity, which needs the vector index) if the index
    hasn't been built yet, so the app still works before build_index.py has
    run."""

    query_text = _track_query_text(track, role, resume_keywords, topic)
    semantic_hits = query_similar(embed_text(query_text), n_results=SEMANTIC_POOL_SIZE)
    semantic_hits = [(qid, dist) for qid, dist in semantic_hits if qid not in exclude_ids]

    if semantic_hits:
        ids = [qid for qid, _ in semantic_hits]
        rows = {q.id: q for q in db.query(Question).filter(Question.id.in_(ids)).all()}
        # semantic_hits is already ordered by similarity — preserve that order into candidates.
        candidates = [(rows[qid], dist) for qid, dist in semantic_hits if qid in rows]

        if candidates:
            tag_matched = [
                (q, dist) for q, dist in candidates if _track_relevance(q, track, role, resume_keywords, topic) > 0
            ]
            pool = tag_matched if tag_matched else candidates[:SEMANTIC_FALLBACK_TOP_K]
            return _score_and_pick(
                pool, track=track, role=role, resume_keywords=resume_keywords, topic=topic, target_difficulty=target_difficulty
            )

    return _pick_from_sql_fallback(db, track, role, resume_keywords, topic, target_difficulty, exclude_ids)


def _pick_from_sql_fallback(db, track, role, resume_keywords, topic, target_difficulty, exclude_ids):
    all_candidates = [q for q in db.query(Question).all() if q.id not in exclude_ids]
    if not all_candidates:
        return None

    tag_matched = [q for q in all_candidates if _track_relevance(q, track, role, resume_keywords, topic) > 0]
    pool = tag_matched or all_candidates

    scored = [
        (
            _score_candidate(
                q,
                track=track,
                role=role,
                resume_keywords=resume_keywords,
                topic=topic,
                target_difficulty=target_difficulty,
                semantic_score=None,
            ),
            q,
        )
        for q in pool
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    top = scored[:TOP_K_CHOICES]
    return random.choice(top)[1]


def retrieve_related_context(db: Session, transcript: str, *, exclude_id: str | None = None, n: int = 3) -> list[Question]:
    """Used by the follow-up generator to ground the LLM prompt with related
    bank questions/concepts pulled from what the candidate actually said."""
    hits = query_similar(embed_text(transcript), n_results=n + 1)
    ids = [qid for qid, _ in hits if qid != exclude_id][:n]
    if not ids:
        return []
    rows = {q.id: q for q in db.query(Question).filter(Question.id.in_(ids)).all()}
    return [rows[i] for i in ids if i in rows]
