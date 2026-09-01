import re

from app.providers.llm.base import LLMProvider
from app.providers.stt.base import TranscriptionResult
from app.services.evaluation_defaults import (
    LLM_SCORED_DIMENSIONS,
    SCORING_BANDS,
    compute_category_scores,
    compute_overall_score,
)
from app.services.llm_json import parse_llm_json

FILLER_WORDS = ["umm", "um", "uh", "uhh", "ah", "like", "you know", "i mean", "basically", "actually", "so yeah"]

ANSWER_FRAMEWORK_DIMENSIONS = [
    "problem_understanding",
    "approach",
    "reasoning",
    "trade_offs",
    "adaptability",
    "communication",
]

_SYSTEM_PROMPT = """You are a cognitive interview evaluator. Your job is to judge HOW the
candidate arrived at their answer, not only whether it happens to be correct — score their
reasoning, justification, and trade-off thinking as their own dimensions, separate from raw
technical correctness.

Calibration example: asked "Why did you use MongoDB?", an answer like "because it's fast" is
weak on problem_solving_reasoning and trade_off_analysis even if the choice itself is
defensible — there's no justification. An answer like "our post/profile schemas are flexible
and expected to evolve, and the document model maps naturally to our API objects; for highly
relational transactional data I'd prefer PostgreSQL" is strong on both, because it states the
actual reasoning AND a trade-off against an alternative. Grade every dimension with that bar:
justification and awareness of alternatives matter as much as the surface-level answer.

Grading against reference key points is FLEXIBLE — any phrasing that covers a key point
counts, exact wording doesn't matter.

You also teach the candidate HOW to think through this specific question — not generic
interview advice, but concretely tied to what THIS question actually demands (e.g. for "How
would you design a URL shortener?", problem_understanding means clarifying expected requests
per day and read:write ratio, not a generic "clarify requirements"). And for whichever of the
candidate's dimensions came out weak, give one specific, actionable tip on how they could have
answered that part better, referencing what they actually said. Respond with ONLY a JSON
object, no markdown fences, no extra prose."""

_USER_TEMPLATE = """QUESTION:
{question}
{adaptability_context}
REFERENCE KEY POINTS a strong answer should cover (any phrasing counts):
{key_points}

SCORE EACH DIMENSION 0-10 using this band guide (applies to every dimension):
{bands}

DIMENSIONS TO SCORE:
- technical_correctness: is the core answer factually/technically right?
- problem_solving_reasoning: did they break the problem down and reason through it logically,
  step by step, rather than jumping straight to a conclusion?
- depth_of_understanding: do they explain WHY/HOW, from fundamentals, rather than reciting a
  memorized answer?
- communication: is the explanation clear and structured, not rambling or disorganized?
- problem_approach: did they move requirements -> approach -> validation in a sensible order?
- adaptability: {adaptability_instruction}
- trade_off_analysis: do they show awareness of alternatives and the pros/cons of their choice
  (e.g. consistency vs availability, SQL vs NoSQL), not just defend one option blindly?

CANDIDATE'S TRANSCRIBED ANSWER:
{transcript}

Return a JSON object with exactly these fields:
{{
  "dimension_scores": {{
    "technical_correctness": <0-10>,
    "problem_solving_reasoning": <0-10>,
    "depth_of_understanding": <0-10>,
    "communication": <0-10>,
    "problem_approach": <0-10>,
    "adaptability": <0-10>,
    "trade_off_analysis": <0-10>
  }},
  "grammar_issues": [ "short description of each grammatical mistake found, empty list if none" ],
  "relevance_score": <integer 0-100, how directly this answers the actual question>,
  "covered_key_points": [ "the key points from the reference list that this answer covers" ],
  "missed_key_points": [ "the key points from the reference list that this answer does NOT cover" ],
  "model_solution": "a concise, well-formed model answer to this question (2-6 sentences), usable as a study reference",
  "answer_framework": {{
    "problem_understanding": "one sentence: what THIS question needs clarified upfront (requirements, scale, users, etc.) before answering",
    "approach": "one sentence: how to break THIS question into components and in what order",
    "reasoning": "one sentence: what justification a strong answer to THIS question must give, not just what to conclude",
    "trade_offs": "one sentence: the specific alternatives/trade-offs THIS question's answer should weigh",
    "adaptability": "one sentence: a plausible way the interviewer could change THIS question's requirements, and what should shift in response",
    "communication": "one sentence: how to structure the delivery of an answer to THIS specific question"
  }},
  "improvement_tips": [
    {{"dimension": "<dimension key from dimension_scores that scored weak>", "tip": "one specific, actionable sentence on how this exact answer could improve on that dimension"}}
  ]
}}
Only include entries in improvement_tips for dimensions that actually scored weak (roughly
below 6/10) — omit dimensions the candidate already did well on, and include at most 4
entries."""

_FALLBACK = {
    "dimension_scores": {},
    "grammar_issues": [],
    "relevance_score": 50,
    "covered_key_points": [],
    "missed_key_points": [],
    "model_solution": "",
    "answer_framework": {},
    "improvement_tips": [],
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


def compute_delivery_clarity(*, filler_words: dict[str, int], pause_count: int) -> float:
    """0-10 algorithmic proxy for hesitation/vagueness in HOW the answer was
    delivered verbally (fillers, pauses) — not eye contact or personality."""
    total_fillers = sum(filler_words.values())
    fluency_penalty = min(100, total_fillers * 5 + pause_count * 8)
    return round(max(0.0, min(10.0, (100 - fluency_penalty) / 10.0)), 1)


async def analyze_answer(
    llm: LLMProvider,
    *,
    question_text: str,
    key_points: list[str],
    transcription: TranscriptionResult,
    eye_contact_ratio: float,
    previous_question: str | None = None,
    previous_answer_transcript: str | None = None,
) -> dict:
    filler_words = count_filler_words(transcription.text)
    pause_count = transcription.count_gaps() if transcription.segments else 0

    if previous_question:
        adaptability_context = (
            f"\nThis is a FOLLOW-UP to an earlier question, asked specifically to see if the "
            f"candidate adapts their thinking. Earlier question: \"{previous_question}\"\n"
            f"Candidate's earlier answer: \"{previous_answer_transcript or '(no answer)'}\"\n"
        )
        adaptability_instruction = (
            "did they meaningfully adjust their approach from their earlier answer to fit this "
            "follow-up's changed requirement, rather than repeating the same answer unchanged?"
        )
    else:
        adaptability_context = "\n"
        adaptability_instruction = (
            "does the answer show awareness that the approach might need to change under "
            "different constraints or scale, even without being explicitly asked?"
        )

    user_prompt = _USER_TEMPLATE.format(
        question=question_text,
        adaptability_context=adaptability_context,
        key_points="\n".join(f"- {kp}" for kp in key_points) or "(no reference key points provided)",
        bands="\n".join(f"- {band}: {desc}" for band, desc in SCORING_BANDS.items()),
        adaptability_instruction=adaptability_instruction,
        transcript=transcription.text or "(empty — candidate did not answer)",
    )

    raw = await llm.chat(_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.2)
    parsed = parse_llm_json(raw, _FALLBACK)

    relevance_score = float(parsed.get("relevance_score", _FALLBACK["relevance_score"]))
    relevance_score = max(0.0, min(100.0, relevance_score))

    raw_dims = parsed.get("dimension_scores") or {}
    dimension_scores = {
        dim: max(0.0, min(10.0, float(raw_dims.get(dim, 0.0)))) for dim in LLM_SCORED_DIMENSIONS
    }
    dimension_scores["delivery_clarity"] = compute_delivery_clarity(
        filler_words=filler_words, pause_count=pause_count
    )

    overall_score = compute_overall_score(dimension_scores)
    category_scores = compute_category_scores(dimension_scores)

    raw_framework = parsed.get("answer_framework") or {}
    answer_framework = {
        key: str(raw_framework.get(key, "")) for key in ANSWER_FRAMEWORK_DIMENSIONS
    }

    raw_tips = parsed.get("improvement_tips") or []
    improvement_tips = [
        {"dimension": str(t.get("dimension", "")), "tip": str(t.get("tip", ""))}
        for t in raw_tips
        if isinstance(t, dict) and t.get("dimension") and t.get("tip")
    ][:4]

    return {
        "transcript": transcription.text,
        "grammar_issues": parsed.get("grammar_issues", []),
        "filler_words": filler_words,
        "pause_count": pause_count,
        "relevance_score": relevance_score,
        "dimension_scores": dimension_scores,
        "overall_score": overall_score,
        "category_scores": category_scores,
        "covered_key_points": parsed.get("covered_key_points", []),
        "missed_key_points": parsed.get("missed_key_points", []),
        "llm_model_solution": parsed.get("model_solution", ""),
        "answer_framework": answer_framework,
        "improvement_tips": improvement_tips,
        "eye_contact_ratio": eye_contact_ratio,
    }
