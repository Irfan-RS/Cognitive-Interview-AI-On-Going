from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.providers.llm.base import LLMProvider
from app.providers.llm.factory import get_llm_provider
from app.repositories import session_repo
from app.schemas.session import CreateSessionRequest, HintOut, SessionOut, SessionSummaryOut
from app.schemas.report import SessionReport
from app.services import hint_service, interview_service, report_service
from app.services.interview_service import NoQuestionsAvailableError, build_turn_out

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _session_out(session, turn) -> SessionOut:
    out = SessionOut.model_validate(session)
    out.current_turn = build_turn_out(session, turn) if turn else None
    return out


def _session_summary_out(session) -> SessionSummaryOut:
    scores = [t.answer.relevance_score for t in session.turns if t.answer is not None]
    overall_scores = [t.answer.overall_score for t in session.turns if t.answer is not None]
    return SessionSummaryOut(
        id=session.id,
        mode=session.mode,
        track=session.track,
        role=session.role,
        topic=session.topic,
        status=session.status,
        created_at=session.created_at,
        completed_at=session.completed_at,
        question_count=len(session.turns),
        average_relevance=round(sum(scores) / len(scores), 1) if scores else None,
        average_overall_score=round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else None,
    )


@router.post("", response_model=SessionOut)
def create_session(req: CreateSessionRequest, db: Session = Depends(get_db)):
    try:
        session, turn = interview_service.start_session(db, req)
    except NoQuestionsAvailableError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _session_out(session, turn)


@router.get("", response_model=list[SessionSummaryOut])
def list_sessions(db: Session = Depends(get_db)):
    return [_session_summary_out(s) for s in session_repo.list_sessions(db)]


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = session_repo.get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    current_turn = session.turns[-1] if session.turns else None
    return _session_out(session, current_turn)


@router.post("/{session_id}/complete", response_model=SessionOut)
def complete_session(session_id: str, db: Session = Depends(get_db)):
    try:
        session = interview_service.complete_session_now(db, session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _session_out(session, None)


@router.get("/{session_id}/report", response_model=SessionReport)
async def get_report(session_id: str, db: Session = Depends(get_db), llm: LLMProvider = Depends(get_llm_provider)):
    session = session_repo.get_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return await report_service.build_report(db, llm, session)


@router.post("/questions/{session_question_id}/hint", response_model=HintOut)
async def get_hint(
    session_question_id: str, db: Session = Depends(get_db), llm: LLMProvider = Depends(get_llm_provider)
):
    turn = session_repo.get_turn(db, session_question_id)
    if turn is None:
        raise HTTPException(status_code=404, detail="Question turn not found")
    session = session_repo.get_session(db, turn.session_id)
    if session.mode != "practice":
        raise HTTPException(status_code=403, detail="Hints are only available in practice mode")

    hint = await hint_service.generate_hint(db, llm, session_question_id=session_question_id)
    return HintOut(hint=hint)
