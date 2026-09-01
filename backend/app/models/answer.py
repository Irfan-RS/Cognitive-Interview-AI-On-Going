import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime


def _uuid() -> str:
    return str(uuid.uuid4())


class Answer(Base):
    """Everything captured for one answered question: the recording, the
    transcript, and the full analysis breakdown — the durable record a
    session report is built from."""

    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_question_id: Mapped[str] = mapped_column(
        ForeignKey("session_questions.id"), nullable=False, unique=True
    )

    audio_path: Mapped[str] = mapped_column(String, default="")
    transcript: Mapped[str] = mapped_column(Text, default="")

    grammar_issues: Mapped[list[str]] = mapped_column(JSON, default=list)
    filler_words: Mapped[dict] = mapped_column(JSON, default=dict)  # {"umm": 3, "like": 2}
    pause_count: Mapped[int] = mapped_column(Integer, default=0)

    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100
    dimension_scores: Mapped[dict] = mapped_column(JSON, default=dict)  # {dimension: 0-10}, the 8-dimension cognitive rubric
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100, weighted composite of dimension_scores
    category_scores: Mapped[dict] = mapped_column(JSON, default=dict)  # {technical/cognitive/communication/adaptability: 0-100}
    covered_key_points: Mapped[list[str]] = mapped_column(JSON, default=list)
    missed_key_points: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Proctoring signal only — deliberately never blended into any score above.
    eye_contact_ratio: Mapped[float] = mapped_column(Float, default=1.0)  # 0-1, from monitoring events

    llm_model_solution: Mapped[str] = mapped_column(Text, default="")
    answer_framework: Mapped[dict] = mapped_column(JSON, default=dict)  # {problem_understanding, approach, reasoning, trade_offs, adaptability, communication} -> how to approach THIS question
    improvement_tips: Mapped[list] = mapped_column(JSON, default=list)  # [{dimension, tip}] for whichever dimensions scored weak
    next_difficulty: Mapped[int] = mapped_column(Integer, default=2)

    submitted_at: Mapped[datetime] = mapped_column(UTCDateTime, default=lambda: datetime.now(timezone.utc))

    session_question: Mapped["SessionQuestion"] = relationship(back_populates="answer")  # noqa: F821
