from sqlalchemy.orm import Session

from app.providers.llm.base import LLMProvider
from app.repositories import session_repo
from app.repositories.question_repo import get_by_id

_SYSTEM_PROMPT = """You are giving a candidate a small nudge in a PRACTICE interview after they've
gone quiet for a while. Give a short hint (1-2 sentences) that points them toward the shape of a
good answer WITHOUT giving the full answer away. Return plain text only, no JSON, no quotes."""


async def generate_hint(db: Session, llm: LLMProvider, *, session_question_id: str) -> str:
    turn = session_repo.get_turn(db, session_question_id)
    if turn is None:
        raise ValueError(f"No such question turn: {session_question_id}")

    key_points: list[str] = []
    if turn.question_id:
        question = get_by_id(db, turn.question_id)
        if question:
            key_points = question.key_points

    user_prompt = f"QUESTION: {turn.question_text}\n\nKEY POINTS (do not list these outright, just nudge toward them):\n" + (
        "\n".join(f"- {kp}" for kp in key_points) if key_points else "(none available — give a general framing nudge)"
    )

    return await llm.chat(_SYSTEM_PROMPT, user_prompt, json_mode=False, temperature=0.5)
