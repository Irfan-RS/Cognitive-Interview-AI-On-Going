from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


ALLOWED_DURATIONS = {5, 10, 30}


class ResumeProjectIn(BaseModel):
    title: str
    description: str


class CreateSessionRequest(BaseModel):
    mode: str = Field(pattern="^(mock|practice)$")
    track: str = Field(pattern="^(role|resume|topic)$")
    role: str | None = None
    resume_keywords: list[str] = Field(default_factory=list)
    resume_projects: list[ResumeProjectIn] = Field(default_factory=list)
    topic: str | None = None
    duration_minutes: int = 10

    @model_validator(mode="after")
    def _check_track_fields(self):
        if self.track == "role" and not self.role:
            raise ValueError("role is required when track='role'")
        if self.track == "resume" and not self.resume_keywords:
            raise ValueError("resume_keywords is required when track='resume'")
        if self.track == "topic" and not self.topic:
            raise ValueError("topic is required when track='topic'")
        if self.duration_minutes not in ALLOWED_DURATIONS:
            raise ValueError(f"duration_minutes must be one of {sorted(ALLOWED_DURATIONS)}")
        return self


class QuestionTurnOut(BaseModel):
    session_question_id: str
    question_text: str
    is_follow_up: bool
    difficulty: int
    hint_after_seconds: int
    auto_record_after_seconds: int
    hints_enabled: bool  # false in mock mode
    topics: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    source_project_title: str | None = None


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    mode: str
    track: str
    role: str | None
    topic: str | None
    status: str
    current_difficulty: int
    duration_minutes: int
    created_at: datetime
    current_turn: QuestionTurnOut | None = None


class HintOut(BaseModel):
    hint: str
    hint_level: int = 1


class SessionSummaryOut(BaseModel):
    """Lightweight per-session row for the dashboard's interview list —
    deliberately excludes per-turn/per-answer detail, which the full
    SessionReport carries instead."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    mode: str
    track: str
    role: str | None
    topic: str | None
    status: str
    created_at: datetime
    completed_at: datetime | None
    question_count: int
    average_relevance: float | None = None
    average_overall_score: float | None = None
