from sqlalchemy.orm import Session

from app.providers.llm.base import LLMProvider
from app.repositories import session_repo
from app.repositories.question_repo import get_by_id

_SYSTEM_PROMPT = """You are nudging a candidate who has gone quiet in a PRACTICE interview.

Rules:
- Point at the NEXT thing to think about, never the answer itself.
- Prefer a question over a statement ("What happens if the input is empty?" beats "Handle the
  empty case") — the goal is to restart their thinking, not to hand over the solution.
- 1-2 sentences, plain text. No JSON, no quotes, no preamble."""


async def generate_hint(db: Session, llm: LLMProvider, *, session_question_id: str, hint_level: int = 1) -> str:
    """Progressive hints: level 1 is the gentlest framing nudge, each level
    narrows further. Authored hints from the bank are used in order when
    present — they're written to escalate without ever revealing the solution;
    beyond them (or with none authored) the LLM generates at that level."""
    turn = session_repo.get_turn(db, session_question_id)
    if turn is None:
        raise ValueError(f"No such question turn: {session_question_id}")

    hint_level = max(1, hint_level)

    key_points: list[str] = []
    progressive_hints: list[str] = []
    concept = ""
    if turn.question_id:
        question = get_by_id(db, turn.question_id)
        if question:
            key_points = question.key_points
            progressive_hints = question.progressive_hints
            concept = question.concept

    # Authored hints are already calibrated for this exact question — prefer them.
    if len(progressive_hints) >= hint_level:
        return progressive_hints[hint_level - 1]

    escalation = {
        1: "Give the GENTLEST possible nudge — just help them frame the problem or ask themselves the right first question.",
        2: "They're still stuck. Narrow it: point at the specific area or consideration they're missing, without saying what the answer is.",
    }.get(hint_level, "They remain stuck. Give the strongest hint you can that still leaves the actual answer for them to state.")

    user_prompt = (
        f"QUESTION: {turn.question_text}\n"
        f"{f'CONCEPT UNDER TEST: {concept}' if concept else ''}\n\n"
        f"KEY POINTS (do NOT list these outright — only nudge toward them):\n"
        + ("\n".join(f"- {kp}" for kp in key_points) if key_points else "(none authored — give a general framing nudge)")
        + f"\n\nHINT LEVEL {hint_level}: {escalation}"
    )

    return await llm.chat(_SYSTEM_PROMPT, user_prompt, json_mode=False, temperature=0.5)
