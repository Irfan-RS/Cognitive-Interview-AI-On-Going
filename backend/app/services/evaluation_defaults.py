"""The cognitive evaluation framework. Every answer is graded on these same
weighted dimensions, plus qualitative reasoning analysis — the goal is not to
rank the candidate but to describe HOW they thought and what to do next.

Proctoring signals (eye contact etc.) never appear here by design."""

# 0-100 per dimension; weights sum to 100.
DIMENSION_WEIGHTS: dict[str, int] = {
    "technical_correctness": 25,
    "problem_understanding": 15,
    "reasoning": 20,
    "problem_solving": 15,
    "communication": 10,
    "depth_of_knowledge": 10,
    "adaptability": 5,
}

DIMENSION_GUIDE: dict[str, str] = {
    "technical_correctness": "Is the substance of the answer actually right?",
    "problem_understanding": "Did they identify requirements, constraints, scale, and edge cases BEFORE solving — or assume?",
    "reasoning": "Is there a justified logical chain, or assertions with no 'why'?",
    "problem_solving": "Did they decompose the problem and work through it methodically?",
    "communication": "Is it structured and followable, or rambling and disorganised?",
    "depth_of_knowledge": "Do they explain from fundamentals, or recite a memorised surface answer?",
    "adaptability": "Do they adjust when constraints change, rather than restating the same answer?",
}

# Qualitative (not numeric) — these describe the SHAPE of the candidate's thinking.
REASONING_FACETS: list[str] = [
    "problem_decomposition",
    "logical_flow",
    "justification",
    "trade_off_analysis",
]
REASONING_RATINGS: list[str] = ["Strong", "Good", "Needs improvement", "Weak", "Not demonstrated"]

SCORING_BANDS: dict[str, str] = {
    "0-20": "Absent, incorrect, or irrelevant",
    "21-40": "Fragmentary — a fragment of the right idea, mostly unsupported",
    "41-60": "Basic but shallow — correct-ish, little justification",
    "61-80": "Solid — correct and reasoned, some gaps in depth or trade-offs",
    "81-95": "Strong — well-justified, considers alternatives and edge cases",
    "96-100": "Exceptional — expert reasoning, trade-offs, and practical grounding",
}

# Which category each dimension rolls up into for the report's headline view.
CATEGORY_GROUPS: dict[str, list[str]] = {
    "technical": ["technical_correctness", "depth_of_knowledge"],
    "cognitive": ["problem_understanding", "reasoning", "problem_solving"],
    "communication": ["communication"],
    "adaptability": ["adaptability"],
}


def compute_overall_score(dimension_scores: dict[str, float]) -> float:
    """Weighted mean of the 0-100 dimension scores -> a single 0-100 score."""
    total_weight = sum(DIMENSION_WEIGHTS.values())
    weighted = sum(dimension_scores.get(dim, 0.0) * w for dim, w in DIMENSION_WEIGHTS.items())
    return round(max(0.0, min(100.0, weighted / total_weight)), 1)


def compute_category_scores(dimension_scores: dict[str, float]) -> dict[str, float]:
    """Weighted average within each category -> 0-100 per category."""
    categories: dict[str, float] = {}
    for category, dims in CATEGORY_GROUPS.items():
        bucket_weight = sum(DIMENSION_WEIGHTS[d] for d in dims)
        if not bucket_weight:
            categories[category] = 0.0
            continue
        weighted = sum(dimension_scores.get(d, 0.0) * DIMENSION_WEIGHTS[d] for d in dims)
        categories[category] = round(max(0.0, min(100.0, weighted / bucket_weight)), 1)
    return categories
