from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.providers.llm.base import LLMProvider
from app.providers.llm.factory import get_llm_provider
from app.providers.stt.base import STTProvider
from app.providers.stt.factory import get_stt_provider
from app.repositories import answer_repo
from app.schemas.answer import AnswerAnalysisOut, NextStepOptions, SubmitAnswerResponse
from app.schemas.session import QuestionTurnOut
from app.schemas.voice import VoiceCommandRequest, VoiceCommandResponse
from app.services import interview_service, voice_service
from app.services.interview_service import AnswerRequiredError, build_turn_out

router = APIRouter(prefix="/questions", tags=["answers"])


@router.get("/{session_question_id}/recording")
def get_recording(session_question_id: str, db: Session = Depends(get_db)):
    answer = answer_repo.get_by_session_question(db, session_question_id)
    if answer is None or not answer.audio_path or not Path(answer.audio_path).exists():
        raise HTTPException(status_code=404, detail="No recording found for this answer")
    return FileResponse(answer.audio_path)


@router.post("/{session_question_id}/answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    session_question_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    llm: LLMProvider = Depends(get_llm_provider),
    stt: STTProvider = Depends(get_stt_provider),
):
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload")

    try:
        answer = await interview_service.submit_answer(
            db, llm, stt, session_question_id=session_question_id, filename=file.filename or "answer.webm", audio_bytes=audio_bytes
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return SubmitAnswerResponse(
        analysis=AnswerAnalysisOut.model_validate(answer),
        next_step_options=NextStepOptions(can_follow_up=True, can_next_question=True),
    )


@router.post("/{session_question_id}/follow-up", response_model=QuestionTurnOut)
async def follow_up(session_question_id: str, db: Session = Depends(get_db), llm: LLMProvider = Depends(get_llm_provider)):
    try:
        session, new_turn = await interview_service.request_follow_up(db, llm, session_question_id=session_question_id)
    except AnswerRequiredError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return build_turn_out(session, new_turn)


@router.post("/{session_question_id}/next")
def next_question(session_question_id: str, db: Session = Depends(get_db)):
    try:
        session, new_turn = interview_service.request_next_question(db, session_question_id=session_question_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if new_turn is None:
        return {"session_completed": True, "current_turn": None}
    return {"session_completed": False, "current_turn": build_turn_out(session, new_turn)}


@router.post("/{session_question_id}/voice-command", response_model=VoiceCommandResponse)
async def voice_command(
    session_question_id: str,
    req: VoiceCommandRequest,
    db: Session = Depends(get_db),
    llm: LLMProvider = Depends(get_llm_provider),
):
    try:
        spoken_text = await voice_service.handle_voice_command(
            db, llm, session_question_id=session_question_id, command=req.command
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return VoiceCommandResponse(spoken_text=spoken_text, command=req.command)
