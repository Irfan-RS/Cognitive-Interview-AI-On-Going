"""Universal cognitive evaluation framework — every answer is graded against
these same 8 weighted dimensions, regardless of which question was asked.
Weights and dimension names match the interview evaluation spec: reasoning
and justification are scored explicitly, separate from raw correctness, and
none of this ever mixes with proctoring signals (eye contact etc.)."""

DIMENSION_WEIGHTS: dict[str, int] = {
    "technical_correctness": 30,
    "problem_solving_reasoning": 20,
    "depth_of_understanding": 15,
    "communication": 10,
    "problem_approach": 10,
    "adaptability": 5,
    "trade_off_analysis": 5,
    "delivery_clarity": 5,
}

# delivery_clarity is computed algorithmically from filler words/pauses
# (see analysis_service.compute_delivery_clarity), not asked of the LLM.
LLM_SCORED_DIMENSIONS: list[str] = [d for d in DIMENSION_WEIGHTS if d != "delivery_clarity"]

CATEGORY_GROUPS: dict[str, list[str]] = {
    "technical": ["technical_correctness", "trade_off_analysis"],
    "cognitive": ["problem_solving_reasoning", "depth_of_understanding", "problem_approach"],
    "communication": ["communication", "delivery_clarity"],
    "adaptability": ["adaptability"],
}

SCORING_BANDS: dict[str, str] = {
    "0-2": "Missing, incorrect, or irrelevant",
    "3-4": "Basic/surface-level, significant gaps, weak or absent justification",
    "5-6": "Solid and correct, meets expectations",
    "7-8": "Strong, detailed, well-justified reasoning",
    "9-10": "Expert-level — deep reasoning, trade-offs, edge cases, genuine justification",
}


def compute_overall_score(dimension_scores: dict[str, float]) -> float:
    """Weighted 0-10 dimension scores -> a single 0-100 composite."""
    total = 0.0
    for dim, weight in DIMENSION_WEIGHTS.items():
        score = dimension_scores.get(dim, 0.0)
        total += (score / 10.0) * weight
    return round(max(0.0, min(100.0, total)), 1)


def compute_category_scores(dimension_scores: dict[str, float]) -> dict[str, float]:
    """Weighted-average each category's member dimensions -> 0-100 per category."""
    categories: dict[str, float] = {}
    for category, dims in CATEGORY_GROUPS.items():
        bucket_weight = sum(DIMENSION_WEIGHTS[d] for d in dims)
        weighted = sum(dimension_scores.get(d, 0.0) / 10.0 * DIMENSION_WEIGHTS[d] for d in dims)
        categories[category] = round(max(0.0, min(100.0, (weighted / bucket_weight) * 100)), 1) if bucket_weight else 0.0
    return categories
