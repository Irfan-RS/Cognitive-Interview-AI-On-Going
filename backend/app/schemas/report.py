from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.answer import AnswerAnalysisOut


class ReportTurn(BaseModel):
    session_question_id: str
    question_text: str
    is_follow_up: bool
    difficulty_at_ask: int
    asked_at: datetime
    topics: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    answer: AnswerAnalysisOut | None
    has_recording: bool = False


class SessionReport(BaseModel):
    session_id: str
    mode: str
    track: str
    role: str | None
    topic: str | None
    status: str
    created_at: datetime
    completed_at: datetime | None
    turns: list[ReportTurn]
    average_relevance: float
    average_confidence: float
    average_eye_contact: float
    readiness_score: float = 0.0
    passed: bool = False
    summary: str = ""
    action_items: list[str] = Field(default_factory=list)
