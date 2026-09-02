import asyncio
import shutil
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.answer import Answer
from app.models.session import InterviewSession, SessionQuestion
from app.providers.llm.base import LLMProvider
from app.providers.stt.base import STTProvider
from app.rag.retriever import select_question
from app.repositories import answer_repo, monitoring_repo, question_repo, session_repo
from app.schemas.session import CreateSessionRequest, QuestionTurnOut
from app.services import analysis_service, difficulty_service, followup_service


class NoQuestionsAvailableError(Exception):
    pass


class AnswerRequiredError(Exception):
    pass


def build_turn_out(session: InterviewSession, turn: SessionQuestion) -> QuestionTurnOut:
    settings = get_settings()
    return QuestionTurnOut(
        session_question_id=turn.id,
        question_text=turn.question_text,
        is_follow_up=turn.is_follow_up,
        difficulty=turn.difficulty_at_ask,
        hint_after_seconds=settings.hint_after_seconds,
        auto_record_after_seconds=settings.auto_record_after_seconds,
        hints_enabled=(session.mode == "practice"),
        topics=turn.topics,
        roles=turn.roles,
    )


def start_session(db: Session, req: CreateSessionRequest) -> tuple[InterviewSession, SessionQuestion]:
    session = session_repo.create_session(
        db,
        mode=req.mode,
        track=req.track,
        role=req.role,
        resume_keywords=req.resume_keywords,
        topic=req.topic,
        duration_minutes=req.duration_minutes,
    )

    question = select_question(
        db,
        track=req.track,
        role=req.role,
        resume_keywords=req.resume_keywords,
        topic=req.topic,
        target_difficulty=session.current_difficulty,
        exclude_ids=set(),
    )
    if question is None:
        raise NoQuestionsAvailableError(
            "No questions in the bank match this track yet. Run scripts/seed_questions.py first."
        )
    question_repo.increment_usage(db, question.id)

    turn = session_repo.add_turn(
        db,
        session=session,
        question_id=question.id,
        question_text=question.question,
        is_follow_up=False,
        parent_id=None,
        difficulty_at_ask=session.current_difficulty,
        topics=question.topics,
        roles=question.roles,
    )
    db.commit()
    db.refresh(session)
    db.refresh(turn)
    return session, turn


async def _save_recording(session_id: str, session_question_id: str, filename: str, audio_bytes: bytes) -> str:
    settings = get_settings()
    ext = Path(filename).suffix or ".webm"
    directory = settings.resolve(settings.recordings_dir) / session_id
    directory.mkdir(parents=True, exist_ok=True)
    out_path = directory / f"{session_question_id}{ext}"
    # Offloaded to a thread: this runs on the shared asyncio event loop, and a
    # synchronous write here would stall every other in-flight request (including
    # the high-frequency monitoring-event endpoint) for the duration of the disk I/O.
    await asyncio.to_thread(out_path.write_bytes, audio_bytes)
    return str(out_path)


async def submit_answer(
    db: Session,
    llm: LLMProvider,
    stt: STTProvider,
    *,
    session_question_id: str,
    filename: str,
    audio_bytes: bytes,
) -> Answer:
    turn = session_repo.get_turn(db, session_question_id)
    if turn is None:
        raise ValueError(f"No such question turn: {session_question_id}")
    session = session_repo.get_session(db, turn.session_id)
    if session is None:
        raise ValueError(f"Turn {session_question_id} has no parent session")

    # Idempotent: a double-click or a client retry after a slow request times out
    # client-side would otherwise re-run the (expensive) transcription + LLM
    # analysis and then crash on the session_question_id UNIQUE constraint.
    existing = answer_repo.get_by_session_question(db, session_question_id)
    if existing is not None:
        return existing

    audio_path = await _save_recording(session.id, turn.id, filename, audio_bytes)
    transcription = await stt.transcribe(audio_path)

    bank_question = question_repo.get_by_id(db, turn.question_id) if turn.question_id else None
    key_points = bank_question.key_points if bank_question else []
    eye_contact_ratio = monitoring_repo.eye_contact_ratio_for_question(db, session_question_id)

    previous_question = previous_answer_transcript = None
    if turn.is_follow_up and turn.parent_id:
        parent_turn = session_repo.get_turn(db, turn.parent_id)
        if parent_turn is not None and parent_turn.answer is not None:
            previous_question = parent_turn.question_text
            previous_answer_transcript = parent_turn.answer.transcript

    analysis = await analysis_service.analyze_answer(
        llm,
        question_text=turn.question_text,
        key_points=key_points,
        transcription=transcription,
        eye_contact_ratio=eye_contact_ratio,
        concept=bank_question.concept if bank_question else None,
        sub_concept=bank_question.sub_concept if bank_question else None,
        expected_reasoning=bank_question.expected_reasoning if bank_question else None,
        common_mistakes=bank_question.common_mistakes if bank_question else None,
        sample_answer=bank_question.sample_answer if bank_question else None,
        previous_question=previous_question,
        previous_answer_transcript=previous_answer_transcript,
    )

    # Adapt on the full cognitive score, not just topical relevance — a
    # perfectly on-topic answer with no reasoning shouldn't escalate difficulty.
    next_difficulty = difficulty_service.next_difficulty(session.current_difficulty, analysis["overall_score"])
    session.current_difficulty = next_difficulty

    answer = answer_repo.create_answer(
        db,
        session_question_id=turn.id,
        audio_path=audio_path,
        transcript=analysis["transcript"],
        grammar_issues=analysis["grammar_issues"],
        filler_words=analysis["filler_words"],
        pause_count=analysis["pause_count"],
        relevance_score=analysis["relevance_score"],
        dimension_scores=analysis["dimension_scores"],
        overall_score=analysis["overall_score"],
        category_scores=analysis["category_scores"],
        covered_key_points=analysis["covered_key_points"],
        missed_key_points=analysis["missed_key_points"],
        eye_contact_ratio=analysis["eye_contact_ratio"],
        llm_model_solution=analysis["llm_model_solution"],
        concepts_demonstrated=analysis["concepts_demonstrated"],
        strengths=analysis["strengths"],
        weaknesses=analysis["weaknesses"],
        reasoning_analysis=analysis["reasoning_analysis"],
        mistakes=analysis["mistakes"],
        hint_required=analysis["hint_required"],
        follow_up_required=analysis["follow_up_required"],
        suggested_follow_up=analysis["suggested_follow_up"],
        improvement_feedback=analysis["improvement_feedback"],
        recommended_next_action=analysis["recommended_next_action"],
        next_difficulty=next_difficulty,
    )
    db.commit()
    db.refresh(answer)
    return answer


async def request_follow_up(db: Session, llm: LLMProvider, *, session_question_id: str) -> tuple[InterviewSession, SessionQuestion]:
    turn = session_repo.get_turn(db, session_question_id)
    if turn is None:
        raise ValueError(f"No such question turn: {session_question_id}")
    answer = answer_repo.get_by_session_question(db, session_question_id)
    if answer is None:
        raise AnswerRequiredError("Submit an answer before requesting a follow-up.")

    session = session_repo.get_session(db, turn.session_id)
    if session is None:
        raise ValueError(f"Turn {session_question_id} has no parent session")

    follow_up_text = await followup_service.generate_follow_up(
        db, llm, question_text=turn.question_text, transcript=answer.transcript, exclude_question_id=turn.question_id
    )

    new_turn = session_repo.add_turn(
        db,
        session=session,
        question_id=None,
        question_text=follow_up_text,
        is_follow_up=True,
        parent_id=turn.id,
        difficulty_at_ask=session.current_difficulty,
        topics=turn.topics,
        roles=turn.roles,
    )
    db.commit()
    db.refresh(session)
    db.refresh(new_turn)
    return session, new_turn


def request_next_question(db: Session, *, session_question_id: str) -> tuple[InterviewSession, SessionQuestion | None]:
    turn = session_repo.get_turn(db, session_question_id)
    if turn is None:
        raise ValueError(f"No such question turn: {session_question_id}")
    session = session_repo.get_session(db, turn.session_id)
    if session is None:
        raise ValueError(f"Turn {session_question_id} has no parent session")

    exclude_ids = session_repo.asked_question_ids(session)
    question = select_question(
        db,
        track=session.track,
        role=session.role,
        resume_keywords=session.resume_keywords,
        topic=session.topic,
        target_difficulty=session.current_difficulty,
        exclude_ids=exclude_ids,
    )

    if question is None:
        session_repo.complete_session(db, session)
        db.commit()
        return session, None
    question_repo.increment_usage(db, question.id)

    new_turn = session_repo.add_turn(
        db,
        session=session,
        question_id=question.id,
        question_text=question.question,
        is_follow_up=False,
        parent_id=None,
        difficulty_at_ask=session.current_difficulty,
        topics=question.topics,
        roles=question.roles,
    )
    db.commit()
    db.refresh(session)
    db.refresh(new_turn)
    return session, new_turn


def delete_session(db: Session, session_id: str) -> None:
    """Deletes a session, its turns/answers/monitoring events, and the audio
    recordings on disk — leaving orphaned recordings behind would quietly grow
    storage/ forever, since nothing else references them once the rows are gone."""
    session = session_repo.get_session(db, session_id)
    if session is None:
        raise ValueError(f"No such session: {session_id}")

    settings = get_settings()
    recordings_dir = settings.resolve(settings.recordings_dir) / session.id

    session_repo.delete_session(db, session)
    db.commit()

    # Only after the DB commit succeeds — deleting files first would leave the
    # rows pointing at recordings that no longer exist if the commit failed.
    if recordings_dir.is_dir():
        shutil.rmtree(recordings_dir, ignore_errors=True)


def complete_session_now(db: Session, session_id: str) -> InterviewSession:
    """Ends a session on demand — either the candidate chose to stop, or the
    client-side duration timer ran out — rather than only completing once the
    question bank for this track is exhausted."""
    session = session_repo.get_session(db, session_id)
    if session is None:
        raise ValueError(f"No such session: {session_id}")
    if session.status != "completed":
        session_repo.complete_session(db, session)
        db.commit()
        db.refresh(session)
    return session
