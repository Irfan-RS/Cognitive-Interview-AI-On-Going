"""Universal evaluation rubric used whenever a question hasn't been authored
with its own evaluation_criteria/scoring_rubric override — every answer is
graded against SOME rubric, question-specific or this default one, never an
unstated one. Dimensions and score bands match the question-bank spec."""

DEFAULT_EVALUATION_CRITERIA = [
    "correctness",
    "completeness",
    "technical_depth",
    "reasoning",
    "practical_understanding",
    "communication",
    "examples",
    "trade_off_awareness",
]

DEFAULT_SCORING_RUBRIC = {
    "0-2": "Incorrect or irrelevant answer",
    "3-4": "Basic understanding but significant gaps",
    "5-6": "Correct basic answer",
    "7-8": "Strong explanation with relevant details",
    "9": "Deep understanding with examples and trade-offs",
    "10": "Expert-level answer with strong reasoning, edge cases, trade-offs, and practical experience",
}


def resolve_criteria(question_criteria: list[str]) -> list[str]:
    return question_criteria or DEFAULT_EVALUATION_CRITERIA


def resolve_rubric(question_rubric: dict[str, str]) -> dict[str, str]:
    return question_rubric or DEFAULT_SCORING_RUBRIC
