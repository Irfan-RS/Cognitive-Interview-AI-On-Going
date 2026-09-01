import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import UTCDateTime


def _uuid() -> str:
    return str(uuid.uuid4())


class MonitoringEvent(Base):
    """Continuous eye/face-contact samples reported by the frontend's
    background gaze-tracking loop. Aggregated per-question into
    Answer.eye_contact_ratio when an answer is submitted."""

    __tablename__ = "monitoring_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id"), nullable=False)
    session_question_id: Mapped[str | None] = mapped_column(
        ForeignKey("session_questions.id"), nullable=True
    )

    in_bounds: Mapped[bool] = mapped_column(Boolean, nullable=False)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)  # e.g. {"gaze_x":.., "gaze_y":.., "reason":"looked_away"}

    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime, default=lambda: datetime.now(timezone.utc))
