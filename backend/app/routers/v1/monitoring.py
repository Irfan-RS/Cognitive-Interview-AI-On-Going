from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories import monitoring_repo
from app.schemas.voice import MonitoringEventIn

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
def record_event(event: MonitoringEventIn, db: Session = Depends(get_db)):
    """High-frequency endpoint: the frontend's gaze/face-tracking loop posts
    here continuously while a question is being answered. Kept intentionally
    thin — no LLM, no heavy validation — so it never becomes the bottleneck."""
    monitoring_repo.record_event(
        db,
        session_id=event.session_id,
        session_question_id=event.session_question_id,
        in_bounds=event.in_bounds,
        meta={"gaze_x": event.gaze_x, "gaze_y": event.gaze_y, "reason": event.reason},
    )
    db.commit()
    return {"recorded": True}
