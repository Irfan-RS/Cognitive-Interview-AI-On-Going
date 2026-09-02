import re

from app.providers.llm.base import LLMProvider
from app.providers.stt.base import TranscriptionResult
from app.services.evaluation_defaults import (
    DIMENSION_GUIDE,
    DIMENSION_WEIGHTS,
    REASONING_FACETS,
    REASONING_RATINGS,
    SCORING_BANDS,
    compute_category_scores,
    compute_overall_score,
)
from app.services.llm_json import parse_llm_json

FILLER_WORDS = ["umm", "um", "uh", "uhh", "ah", "like", "you know", "i mean", "basically", "actually", "so yeah"]

# Below this, the candidate is struggling enough that a hint serves them better
# than another question; above the follow-up bar, probe deeper instead.
HINT_THRESHOLD = 40.0
FOLLOW_UP_CEILING = 85.0

_SYSTEM_PROMPT = """You are a cognitive interview evaluator. Your job is NOT to rank the
candidate — it is to describe HOW they thought, where their reasoning broke down, and what
would make them better. Judge the reasoning process as seriously as the final answer.

Calibration: asked "Why MongoDB?", "because it's fast" is weak on reasoning and
trade_off_analysis even though the choice may be defensible — there is no justification.
"Our post schemas are flexible and expected to evolve, and documents map to our API objects;
for relational transactional data I'd use PostgreSQL" is strong on both — it states the actual
reasoning AND weighs an alternative.

Rules — follow every one:
1. SCORE EACH DIMENSION INDEPENDENTLY. They measure different things and must NOT all receive
   the same number. A candidate can be technically correct (high) while justifying nothing
   (low). Before scoring, ask yourself per dimension: what in THIS answer evidences it?
2. "strengths" and "weaknesses" must describe what the CANDIDATE ACTUALLY SAID OR OMITTED.
   Never copy items from the reference key points into "strengths" unless the candidate
   genuinely demonstrated them. If they did not say it, it is a weakness, not a strength.
3. "concepts_demonstrated" means technical concepts the candidate showed command of
   (e.g. "Prefix Sum", "Hash Map", "CAP theorem") — never dimension names, never generic words.
4. "reasoning_analysis" ratings must be CONSISTENT with the scores. A weak answer cannot be
   "Good" across every facet. Use "Not demonstrated" when the answer gives no evidence either way.
5. "mistakes" holds concrete errors or unjustified leaps. If there are none, return an empty
   list — never the string "Not demonstrated".
6. An answer that reaches the right conclusion with no justification is NOT a strong answer:
   score reasoning and depth_of_knowledge low even when technical_correctness is high.
7. improvement_feedback must be actionable coaching ("state the brute-force approach and its
   bottleneck before jumping to the optimised one"), never a vague platitude.
8. If the answer is empty or clearly unattempted, score near zero across the board.

Respond with ONLY a JSON object. No markdown fences, no prose outside the JSON."""

_USER_TEMPLATE = """QUESTION ASKED:
{question}
{cognitive_context}{adaptability_context}
REFERENCE KEY POINTS a strong answer would cover (any phrasing counts — do not require exact wording):
{key_points}

CANDIDATE'S TRANSCRIBED ANSWER:
{transcript}

DELIVERY SIGNALS (context for the communication score only): {delivery}

Score each dimension 0-100 using these bands:
{bands}

DIMENSIONS:
{dimensions}

Return a JSON object with exactly these fields, IN THIS ORDER:
{{
  "dimension_evidence": {{
    "technical_correctness": "max 10 words: what evidences this, or what was absent",
    "problem_understanding": "max 10 words",
    "reasoning": "max 10 words",
    "problem_solving": "max 10 words",
    "communication": "max 10 words",
    "depth_of_knowledge": "max 10 words",
    "adaptability": "max 10 words"
  }},
  "technical_correctness": <0-100>,
  "problem_understanding": <0-100>,
  "reasoning": <0-100>,
  "problem_solving": <0-100>,
  "communication": <0-100>,
  "depth_of_knowledge": <0-100>,
  "adaptability": <0-100>,
  "concepts_demonstrated": ["concepts the candidate actually showed command of"],
  "strengths": ["specific things they did well, referencing what they said"],
  "weaknesses": ["specific gaps, referencing what they said or failed to say"],
  "reasoning_analysis": {{
    "problem_decomposition": "<{ratings}>",
    "logical_flow": "<{ratings}>",
    "justification": "<{ratings}>",
    "trade_off_analysis": "<{ratings}>"
  }},
  "mistakes": ["concrete errors or unjustified leaps, empty list if none"],
  "follow_up_question": "one targeted question probing the single biggest gap in THIS answer",
  "improvement_feedback": "2-3 sentences of specific, actionable coaching on how to answer better next time",
  "recommended_next_action": "what the interviewer should do next and why",
  "relevance_score": <0-100, how directly this addressed the question actually asked>,
  "grammar_issues": ["notable grammatical problems, empty list if none"],
  "covered_key_points": ["reference key points this answer covered"],
  "missed_key_points": ["reference key points this answer did NOT cover"]{model_solution_field}
}}

Write dimension_evidence FIRST and let each score follow from its own evidence — that is what
stops every dimension collapsing to the same number."""

_FALLBACK: dict = {
    "concepts_demonstrated": [],
    "strengths": [],
    "weaknesses": [],
    "reasoning_analysis": {},
    "mistakes": [],
    "follow_up_question": "",
    "improvement_feedback": "",
    "recommended_next_action": "",
    "relevance_score": 0,
    "grammar_issues": [],
    "covered_key_points": [],
    "missed_key_points": [],
    "model_solution": "",
}


def count_filler_words(transcript: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    lower = transcript.lower()
    for filler in FILLER_WORDS:
        n = len(re.findall(r"\b" + re.escape(filler) + r"\b", lower))
        if n:
            counts[filler] = n
    return counts


# Small local models sometimes emit a rating word as a list ITEM ("mistakes":
# ["Not demonstrated"]) instead of an empty list — which would render to the
# candidate as a mistake literally named "Not demonstrated".
_NON_ITEMS = {
    "not demonstrated", "none", "n/a", "na", "nothing", "no mistakes",
    "absent", "not applicable", "no weaknesses", "no strengths", "-", "",
}


def _clean_str_list(value, limit: int = 8) -> list[str]:
    if not isinstance(value, list):
        return []
    out = []
    for v in value:
        text = str(v).strip()
        if text and text.lower().rstrip(".") not in _NON_ITEMS:
            out.append(text)
    return out[:limit]


def _drop_contradictory_strengths(strengths: list[str], *contradicting: list[str]) -> list[str]:
    """Drop any "strength" the model simultaneously listed as a missed key point,
    a weakness, or a mistake — a self-contradiction that would otherwise credit
    the candidate for something the same response says they failed to do."""
    blocked = {item.strip().lower() for group in contradicting for item in group}
    if not blocked:
        return strengths
    return [s for s in strengths if s.strip().lower() not in blocked]


def _normalize_reasoning_analysis(raw) -> dict[str, str]:
    """Coerce to the fixed facet set with valid ratings — the report renders
    these as labelled chips, so an unexpected key or free-text rating would
    silently render as junk."""
    raw = raw if isinstance(raw, dict) else {}
    lookup = {r.lower(): r for r in REASONING_RATINGS}
    out: dict[str, str] = {}
    for facet in REASONING_FACETS:
        out[facet] = lookup.get(str(raw.get(facet, "")).strip().lower(), "Not demonstrated")
    return out


def _build_cognitive_context(
    concept: str | None,
    sub_concept: str | None,
    expected_reasoning: str | None,
    common_mistakes: list[str] | None,
) -> str:
    """Authored cognitive scaffolding for this question, when the bank has it —
    it makes grading far more consistent than letting the model infer the
    intended reasoning path from the question text alone."""
    parts = []
    if concept:
        parts.append(f"CONCEPT UNDER TEST: {concept}" + (f" -> {sub_concept}" if sub_concept else ""))
    if expected_reasoning:
        parts.append(f"EXPECTED REASONING PATH (how a strong candidate gets there):\n{expected_reasoning}")
    if common_mistakes:
        parts.append(
            "COMMON MISTAKES on this question (flag them in 'mistakes' if present):\n"
            + "\n".join(f"- {m}" for m in common_mistakes)
        )
    return ("\n" + "\n\n".join(parts) + "\n") if parts else ""


def _build_unanswered_result(key_points: list[str], eye_contact_ratio: float) -> dict:
    """A silent/empty recording is not worth an LLM round-trip: the outcome is
    always the same (score near zero, "you didn't answer"), so skip straight to
    it instead of waiting 5-90s on a call whose answer we already know."""
    dimension_scores = {dim: 0.0 for dim in DIMENSION_WEIGHTS}
    return {
        "transcript": "",
        "filler_words": {},
        "pause_count": 0,
        "relevance_score": 0.0,
        "dimension_scores": dimension_scores,
        "overall_score": 0.0,
        "category_scores": compute_category_scores(dimension_scores),
        "concepts_demonstrated": [],
        "strengths": [],
        "weaknesses": ["No answer was recorded for this question."],
        "reasoning_analysis": _normalize_reasoning_analysis({}),
        "mistakes": [],
        "hint_required": True,
        "follow_up_required": False,
        "suggested_follow_up": "",
        "improvement_feedback": "You didn't record an answer — start recording and speak your response before submitting.",
        "recommended_next_action": "Re-record and answer the question before moving on.",
        "grammar_issues": [],
        "covered_key_points": [],
        "missed_key_points": list(key_points),
        "llm_model_solution": "",
        "eye_contact_ratio": eye_contact_ratio,
    }


async def analyze_answer(
    llm: LLMProvider,
    *,
    question_text: str,
    key_points: list[str],
    transcription: TranscriptionResult,
    eye_contact_ratio: float,
    concept: str | None = None,
    sub_concept: str | None = None,
    expected_reasoning: str | None = None,
    common_mistakes: list[str] | None = None,
    sample_answer: str | None = None,
    previous_question: str | None = None,
    previous_answer_transcript: str | None = None,
) -> dict:
    if not transcription.text.strip():
        return _build_unanswered_result(key_points, eye_contact_ratio)

    filler_words = count_filler_words(transcription.text)
    pause_count = transcription.count_gaps() if transcription.segments else 0

    if previous_question:
        adaptability_context = (
            f"\nThis is a FOLLOW-UP, asked to test whether the candidate ADAPTS.\n"
            f'Earlier question: "{previous_question}"\n'
            f'Their earlier answer: "{previous_answer_transcript or "(no answer)"}"\n'
            f"Score adaptability on whether they meaningfully adjusted their thinking here, "
            f"rather than repeating the same answer.\n"
        )
    else:
        adaptability_context = ""

    total_fillers = sum(filler_words.values())
    delivery = f"{total_fillers} filler word(s), {pause_count} long pause(s)"

    # Bank questions already ship an authored reference answer — regenerating one
    # per submission is the single most expensive part of the response and adds
    # nothing. Only ask for it when there genuinely isn't one (generated follow-ups).
    needs_model_solution = not (sample_answer or "").strip()
    model_solution_field = (
        ',\n  "model_solution": "a concise model answer (2-6 sentences) usable as a study reference"'
        if needs_model_solution
        else ""
    )

    user_prompt = _USER_TEMPLATE.format(
        model_solution_field=model_solution_field,
        question=question_text,
        cognitive_context=_build_cognitive_context(concept, sub_concept, expected_reasoning, common_mistakes),
        adaptability_context=adaptability_context,
        key_points="\n".join(f"- {kp}" for kp in key_points) or "(none authored for this question)",
        transcript=transcription.text or "(empty — the candidate did not answer)",
        delivery=delivery,
        bands="\n".join(f"- {band}: {desc}" for band, desc in SCORING_BANDS.items()),
        dimensions="\n".join(f"- {dim}: {guide}" for dim, guide in DIMENSION_GUIDE.items()),
        ratings=" | ".join(REASONING_RATINGS),
    )

    raw = await llm.chat(_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.2)
    parsed = parse_llm_json(raw, _FALLBACK)

    def score(key: str) -> float:
        try:
            return max(0.0, min(100.0, float(parsed.get(key, 0.0))))
        except (TypeError, ValueError):
            return 0.0

    dimension_scores = {dim: score(dim) for dim in DIMENSION_WEIGHTS}
    overall_score = compute_overall_score(dimension_scores)
    category_scores = compute_category_scores(dimension_scores)

    # Derived from the scores rather than trusted from the model, so the
    # interview flow's behaviour stays predictable and tunable.
    hint_required = overall_score < HINT_THRESHOLD
    follow_up_required = HINT_THRESHOLD <= overall_score < FOLLOW_UP_CEILING

    return {
        "transcript": transcription.text,
        "filler_words": filler_words,
        "pause_count": pause_count,
        "relevance_score": score("relevance_score"),
        "dimension_scores": dimension_scores,
        "overall_score": overall_score,
        "category_scores": category_scores,
        "concepts_demonstrated": [
            c for c in _clean_str_list(parsed.get("concepts_demonstrated")) if c not in DIMENSION_WEIGHTS
        ],
        "strengths": _drop_contradictory_strengths(
            _clean_str_list(parsed.get("strengths")),
            _clean_str_list(parsed.get("missed_key_points")),
            _clean_str_list(parsed.get("weaknesses")),
            _clean_str_list(parsed.get("mistakes")),
        ),
        "weaknesses": _clean_str_list(parsed.get("weaknesses")),
        "reasoning_analysis": _normalize_reasoning_analysis(parsed.get("reasoning_analysis")),
        "mistakes": _clean_str_list(parsed.get("mistakes")),
        "hint_required": hint_required,
        "follow_up_required": follow_up_required,
        "suggested_follow_up": str(parsed.get("follow_up_question", "")).strip(),
        "improvement_feedback": str(parsed.get("improvement_feedback", "")).strip(),
        "recommended_next_action": str(parsed.get("recommended_next_action", "")).strip(),
        "grammar_issues": _clean_str_list(parsed.get("grammar_issues")),
        "covered_key_points": _clean_str_list(parsed.get("covered_key_points")),
        "missed_key_points": _clean_str_list(parsed.get("missed_key_points")),
        "llm_model_solution": (sample_answer or "").strip() or str(parsed.get("model_solution", "")).strip(),
        "eye_contact_ratio": eye_contact_ratio,
    }
