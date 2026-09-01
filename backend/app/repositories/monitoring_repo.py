from sqlalchemy.orm import Session

from app.models.monitoring import MonitoringEvent


def record_event(
    db: Session, *, session_id: str, session_question_id: str | None, in_bounds: bool, meta: dict
) -> MonitoringEvent:
    event = MonitoringEvent(session_id=session_id, session_question_id=session_question_id, in_bounds=in_bounds, meta=meta)
    db.add(event)
    db.flush()
    return event


def eye_contact_ratio_for_question(db: Session, session_question_id: str) -> float:
    """Fraction of samples where the candidate's gaze/face stayed within
    the calibrated screen bounds while this question was being answered.
    Defaults to 1.0 (benefit of the doubt) if no samples were reported."""
    events = (
        db.query(MonitoringEvent).filter(MonitoringEvent.session_question_id == session_question_id).all()
    )
    if not events:
        return 1.0
    in_bounds_count = sum(1 for e in events if e.in_bounds)
    return round(in_bounds_count / len(events), 4)


def look_away_count_for_session(db: Session, session_id: str) -> int:
    """Number of distinct 'looked away' episodes for the session — a
    transition into out-of-bounds, not a raw sample count — matching "how
    many times did you look away" rather than "what fraction of samples"."""
    events = (
        db.query(MonitoringEvent)
        .filter(MonitoringEvent.session_id == session_id)
        .order_by(MonitoringEvent.recorded_at)
        .all()
    )
    count = 0
    was_in_bounds = True
    for event in events:
        if not event.in_bounds and was_in_bounds:
            count += 1
        was_in_bounds = event.in_bounds
    return count
