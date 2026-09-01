import re

from app.providers.llm.base import LLMProvider
from app.providers.stt.base import TranscriptionResult
from app.services.evaluation_defaults import resolve_criteria, resolve_rubric
from app.services.llm_json import parse_llm_json

FILLER_WORDS = ["umm", "um", "uh", "uhh", "ah", "like", "you know", "i mean", "basically", "actually", "so yeah"]

_SYSTEM_PROMPT = """You are grading a spoken interview answer against a defined rubric. Be
fair and specific. Score relevance on how directly the answer addresses what was actually
asked versus a generic/off-topic response. Grading against key points is FLEXIBLE — any
phrasing that covers a key point counts, exact wording doesn't matter. Respond with ONLY a
JSON object, no markdown fences, no extra prose."""

_USER_TEMPLATE = """QUESTION:
{question}

REFERENCE KEY POINTS a strong answer should cover (any phrasing counts):
{key_points}

EVALUATION DIMENSIONS to weigh when judging this answer:
{criteria}

SCORING RUBRIC (0-10 scale):
{rubric}

CANDIDATE'S TRANSCRIBED ANSWER:
{transcript}

Return a JSON object with exactly these fields:
{{
  "grammar_issues": [ "short description of each grammatical mistake found, empty list if none" ],
  "relevance_score": <integer 0-100, how directly this answers the actual question>,
  "rubric_score": <number 0-10, this answer's overall quality per the scoring rubric above>,
  "covered_key_points": [ "the key points from the reference list that this answer covers" ],
  "missed_key_points": [ "the key points from the reference list that this answer does NOT cover" ],
  "model_solution": "a concise, well-formed model answer to this question (2-6 sentences), usable as a study reference"
}}"""

_FALLBACK = {
    "grammar_issues": [],
    "relevance_score": 50,
    "rubric_score": 5,
    "covered_key_points": [],
    "missed_key_points": [],
    "model_solution": "",
}


def count_filler_words(transcript: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    lower = transcript.lower()
    for filler in FILLER_WORDS:
        pattern = r"\b" + re.escape(filler) + r"\b"
        n = len(re.findall(pattern, lower))
        if n:
            counts[filler] = n
    return counts


def compute_confidence_score(*, relevance_score: float, filler_words: dict[str, int], pause_count: int, eye_contact_ratio: float) -> float:
    """Composite 0-100 score blending answer quality, delivery fluency, and
    on-screen eye contact — the number surfaced to the candidate as their
    overall "confidence" for that answer."""
    total_fillers = sum(filler_words.values())
    fluency_penalty = min(100, total_fillers * 5 + pause_count * 8)
    fluency_score = 100 - fluency_penalty

    composite = 0.45 * relevance_score + 0.30 * fluency_score + 0.25 * (eye_contact_ratio * 100)
    return round(max(0.0, min(100.0, composite)), 1)


async def analyze_answer(
    llm: LLMProvider,
    *,
    question_text: str,
    key_points: list[str],
    transcription: TranscriptionResult,
    eye_contact_ratio: float,
    evaluation_criteria: list[str] | None = None,
    scoring_rubric: dict[str, str] | None = None,
) -> dict:
    filler_words = count_filler_words(transcription.text)
    pause_count = transcription.count_gaps() if transcription.segments else 0

    criteria = resolve_criteria(evaluation_criteria or [])
    rubric = resolve_rubric(scoring_rubric or {})

    user_prompt = _USER_TEMPLATE.format(
        question=question_text,
        key_points="\n".join(f"- {kp}" for kp in key_points) or "(no reference key points provided)",
        criteria=", ".join(criteria),
        rubric="\n".join(f"- {band}: {desc}" for band, desc in rubric.items()),
        transcript=transcription.text or "(empty — candidate did not answer)",
    )

    raw = await llm.chat(_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.2)
    parsed = parse_llm_json(raw, _FALLBACK)

    relevance_score = float(parsed.get("relevance_score", _FALLBACK["relevance_score"]))
    relevance_score = max(0.0, min(100.0, relevance_score))

    rubric_score = float(parsed.get("rubric_score", _FALLBACK["rubric_score"]))
    rubric_score = max(0.0, min(10.0, rubric_score))

    confidence_score = compute_confidence_score(
        relevance_score=relevance_score,
        filler_words=filler_words,
        pause_count=pause_count,
        eye_contact_ratio=eye_contact_ratio,
    )

    return {
        "transcript": transcription.text,
        "grammar_issues": parsed.get("grammar_issues", []),
        "filler_words": filler_words,
        "pause_count": pause_count,
        "relevance_score": relevance_score,
        "rubric_score": rubric_score,
        "covered_key_points": parsed.get("covered_key_points", []),
        "missed_key_points": parsed.get("missed_key_points", []),
        "llm_model_solution": parsed.get("model_solution", ""),
        "eye_contact_ratio": eye_contact_ratio,
        "confidence_score": confidence_score,
    }
