from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.monitoring import MonitoringEvent
from app.models.session import InterviewSession, SessionQuestion


def create_session(
    db: Session,
    *,
    mode: str,
    track: str,
    role: str | None,
    resume_keywords: list[str],
    topic: str | None,
    duration_minutes: int = 10,
) -> InterviewSession:
    session = InterviewSession(
        mode=mode,
        track=track,
        role=role,
        resume_keywords=resume_keywords,
        topic=topic,
        current_difficulty=2,
        duration_minutes=duration_minutes,
    )
    db.add(session)
    db.flush()
    return session


def get_session(db: Session, session_id: str) -> InterviewSession | None:
    return db.get(InterviewSession, session_id)


def list_sessions(db: Session) -> list[InterviewSession]:
    return db.query(InterviewSession).order_by(InterviewSession.created_at.desc()).all()


def add_turn(
    db: Session,
    *,
    session: InterviewSession,
    question_id: str | None,
    question_text: str,
    is_follow_up: bool,
    parent_id: str | None,
    difficulty_at_ask: int,
    topics: list[str] | None = None,
    roles: list[str] | None = None,
) -> SessionQuestion:
    order_index = len(session.turns)
    turn = SessionQuestion(
        session_id=session.id,
        question_id=question_id,
        parent_id=parent_id,
        question_text=question_text,
        is_follow_up=is_follow_up,
        difficulty_at_ask=difficulty_at_ask,
        order_index=order_index,
        topics=topics or [],
        roles=roles or [],
    )
    db.add(turn)
    db.flush()
    return turn


def get_turn(db: Session, session_question_id: str) -> SessionQuestion | None:
    return db.get(SessionQuestion, session_question_id)


def asked_question_ids(session: InterviewSession) -> set[str]:
    return {t.question_id for t in session.turns if t.question_id}


def complete_session(db: Session, session: InterviewSession) -> None:
    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)
    db.flush()


def delete_session(db: Session, session: InterviewSession) -> None:
    """Removes a session and everything hanging off it. Turns (and their
    answers) cascade via the ORM relationships, but monitoring events are
    plain FK rows with no relationship mapped, so they're cleared explicitly —
    otherwise they'd be orphaned rows pointing at a session that no longer
    exists."""
    db.query(MonitoringEvent).filter(MonitoringEvent.session_id == session.id).delete(synchronize_session=False)
    db.delete(session)
    db.flush()
