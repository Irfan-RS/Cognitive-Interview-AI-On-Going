import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime


def _uuid() -> str:
    return str(uuid.uuid4())


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    mode: Mapped[str] = mapped_column(String, nullable=False)  # mock | practice
    track: Mapped[str] = mapped_column(String, nullable=False)  # role | resume | topic

    role: Mapped[str | None] = mapped_column(String, nullable=True)
    resume_keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    topic: Mapped[str | None] = mapped_column(String, nullable=True)

    status: Mapped[str] = mapped_column(String, default="active")  # active | completed
    current_difficulty: Mapped[int] = mapped_column(Integer, default=2)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=10)

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    turns: Mapped[list["SessionQuestion"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="SessionQuestion.order_index"
    )


class SessionQuestion(Base):
    """One asked question within a session — either pulled from the bank
    (question_id set) or generated as a follow-up (question_id null,
    text stored directly and linked back via parent_id)."""

    __tablename__ = "session_questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id"), nullable=False)
    question_id: Mapped[str | None] = mapped_column(ForeignKey("questions.id"), nullable=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("session_questions.id"), nullable=True)

    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_follow_up: Mapped[bool] = mapped_column(default=False)
    difficulty_at_ask: Mapped[int] = mapped_column(Integer, default=2)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # Bank questions carry these directly; a generated follow-up inherits them
    # from the question it's following up on, so every turn stays taggable.
    topics: Mapped[list[str]] = mapped_column(JSON, default=list)
    roles: Mapped[list[str]] = mapped_column(JSON, default=list)

    asked_at: Mapped[datetime] = mapped_column(UTCDateTime, default=lambda: datetime.now(timezone.utc))

    session: Mapped[InterviewSession] = relationship(back_populates="turns")
    # delete-orphan matters here: Answer.session_question_id is NOT NULL, so
    # without a cascade, deleting a turn would try to null it out and fail.
    answer: Mapped["Answer | None"] = relationship(
        back_populates="session_question", uselist=False, cascade="all, delete-orphan"
    )
