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
    rubric_score: float
    covered_key_points: list[str]
    missed_key_points: list[str]
    eye_contact_ratio: float
    confidence_score: float
    llm_model_solution: str
    next_difficulty: int
    submitted_at: datetime


class NextStepOptions(BaseModel):
    can_follow_up: bool
    can_next_question: bool


class SubmitAnswerResponse(BaseModel):
    analysis: AnswerAnalysisOut
    next_step_options: NextStepOptions
