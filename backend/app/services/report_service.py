from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.session import InterviewSession
from app.providers.llm.base import LLMProvider
from app.schemas.answer import AnswerAnalysisOut
from app.schemas.report import ReportTurn, SessionReport
from app.services.llm_json import parse_llm_json

_SYSTEM_PROMPT = """You are an interview coach reviewing a candidate's full mock/practice
session. You're given the transcript, relevance score, grammar issues, filler words, and
missed key points for every question they answered. Write a short overall summary and a
concrete, prioritized list of actions the candidate should take before their next real
interview. Be specific — reference what actually happened, not generic advice. Respond with
ONLY a JSON object, no markdown fences, no extra prose."""

_USER_TEMPLATE = """SESSION: {mode} mode, {track} track, {question_count} question(s) answered.

PER-QUESTION BREAKDOWN:
{breakdown}

Return a JSON object with exactly these fields:
{{
  "summary": "2-3 sentence overall assessment of how the candidate performed",
  "action_items": [ "one specific, actionable next step per line, 4-8 items" ]
}}"""

_FALLBACK = {"summary": "", "action_items": []}


def _format_breakdown(session: InterviewSession) -> str:
    blocks = []
    for i, turn in enumerate(session.turns, start=1):
        if turn.answer is None:
            continue
        a = turn.answer
        blocks.append(
            f"Q{i}: {turn.question_text}\n"
            f"  Relevance: {a.relevance_score}% | Confidence: {a.confidence_score}\n"
            f"  Grammar issues: {'; '.join(a.grammar_issues) or 'none'}\n"
            f"  Filler words: {', '.join(a.filler_words.keys()) or 'none'}\n"
            f"  Missed key points: {'; '.join(a.missed_key_points) or 'none'}"
        )
    return "\n\n".join(blocks) if blocks else "(no questions were answered)"


async def _generate_summary_and_actions(llm: LLMProvider, session: InterviewSession) -> dict:
    has_answers = any(turn.answer is not None for turn in session.turns)
    if not has_answers:
        return _FALLBACK

    user_prompt = _USER_TEMPLATE.format(
        mode=session.mode,
        track=session.track,
        question_count=sum(1 for t in session.turns if t.answer is not None),
        breakdown=_format_breakdown(session),
    )
    raw = await llm.chat(_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.3)
    parsed = parse_llm_json(raw, _FALLBACK)
    return {
        "summary": parsed.get("summary") or _FALLBACK["summary"],
        "action_items": parsed.get("action_items") or _FALLBACK["action_items"],
    }


async def build_report(db: Session, llm: LLMProvider, session: InterviewSession) -> SessionReport:
    turns: list[ReportTurn] = []
    relevance_scores: list[float] = []
    confidence_scores: list[float] = []
    eye_contact_ratios: list[float] = []

    for turn in session.turns:
        answer_out = None
        if turn.answer is not None:
            answer_out = AnswerAnalysisOut.model_validate(turn.answer)
            relevance_scores.append(turn.answer.relevance_score)
            confidence_scores.append(turn.answer.confidence_score)
            eye_contact_ratios.append(turn.answer.eye_contact_ratio)

        turns.append(
            ReportTurn(
                session_question_id=turn.id,
                question_text=turn.question_text,
                is_follow_up=turn.is_follow_up,
                difficulty_at_ask=turn.difficulty_at_ask,
                asked_at=turn.asked_at,
                topics=turn.topics,
                roles=turn.roles,
                answer=answer_out,
                has_recording=bool(turn.answer and turn.answer.audio_path),
            )
        )

    def avg(values: list[float]) -> float:
        return round(sum(values) / len(values), 1) if values else 0.0

    average_relevance = avg(relevance_scores)
    average_confidence = avg(confidence_scores)
    average_eye_contact = avg([r * 100 for r in eye_contact_ratios])

    # Weighted composite favoring answer quality over delivery — matches the same
    # relevance-led weighting difficulty_service uses to judge answer strength.
    readiness_score = round(0.5 * average_relevance + 0.3 * average_confidence + 0.2 * average_eye_contact, 1)
    passed = bool(relevance_scores) and readiness_score >= get_settings().readiness_pass_threshold

    narrative = await _generate_summary_and_actions(llm, session)

    return SessionReport(
        session_id=session.id,
        mode=session.mode,
        track=session.track,
        role=session.role,
        topic=session.topic,
        status=session.status,
        created_at=session.created_at,
        completed_at=session.completed_at,
        turns=turns,
        average_relevance=average_relevance,
        average_confidence=average_confidence,
        average_eye_contact=average_eye_contact,
        readiness_score=readiness_score,
        passed=passed,
        summary=narrative["summary"],
        action_items=narrative["action_items"],
    )
