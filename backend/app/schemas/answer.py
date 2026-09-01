from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AnswerAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_question_id: str
    transcript: str
    grammar_issues: list[str]
    filler_words: dict[str, int]
    pause_count: int
    relevance_score: float
    dimension_scores: dict[str, float]
    overall_score: float
    category_scores: dict[str, float]
    covered_key_points: list[str]
    missed_key_points: list[str]
    eye_contact_ratio: float
    llm_model_solution: str

    concepts_demonstrated: list[str]
    strengths: list[str]
    weaknesses: list[str]
    reasoning_analysis: dict[str, str]
    mistakes: list[str]
    hint_required: bool
    follow_up_required: bool
    suggested_follow_up: str
    improvement_feedback: str
    recommended_next_action: str
    next_difficulty: int
    submitted_at: datetime


class NextStepOptions(BaseModel):
    can_follow_up: bool
    can_next_question: bool


class SubmitAnswerResponse(BaseModel):
    analysis: AnswerAnalysisOut
    next_step_options: NextStepOptions
