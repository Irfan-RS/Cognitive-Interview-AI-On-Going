from sqlalchemy.orm import Session

from app.providers.llm.base import LLMProvider
from app.rag.retriever import retrieve_related_context
from app.services.llm_json import parse_llm_json

_SYSTEM_PROMPT = """You are an interviewer generating ONE natural follow-up question that digs
deeper into what the candidate just said — not a generic canned second question. It should feel
like a real interviewer reacting to the specific content of the answer. Keep it to one sentence.
Respond with ONLY a JSON object, no markdown fences, no extra prose."""

_USER_TEMPLATE = """ORIGINAL QUESTION:
{question}

CANDIDATE'S ANSWER (transcribed):
{transcript}

RELATED CONCEPTS THAT MAY BE RELEVANT (for grounding, not required to use):
{related}

Generate one natural follow-up question that probes deeper into something specific the
candidate said — e.g. asks them to justify a choice they made, handle an edge case, explain
a trade-off, or go one level more technical on a point they raised.

Return a JSON object with exactly this field:
{{ "follow_up_question": "the follow-up question, one sentence" }}"""

_FALLBACK = {"follow_up_question": "Can you go a bit deeper into the approach you just described?"}


async def generate_follow_up(
    db: Session, llm: LLMProvider, *, question_text: str, transcript: str, exclude_question_id: str | None
) -> str:
    related = retrieve_related_context(db, transcript, exclude_id=exclude_question_id, n=3)
    related_text = "\n".join(f"- {q.question}" for q in related) or "(none found)"

    user_prompt = _USER_TEMPLATE.format(question=question_text, transcript=transcript or "(no answer given)", related=related_text)
    raw = await llm.chat(_SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.6)
    parsed = parse_llm_json(raw, _FALLBACK)

    return parsed.get("follow_up_question") or _FALLBACK["follow_up_question"]


async def rephrase_question(llm: LLMProvider, *, question_text: str) -> str:
    system = "Rephrase the interview question in simpler, clearer words without changing what it's asking. One sentence. Return plain text only, no JSON, no quotes."
    return await llm.chat(system, question_text, json_mode=False, temperature=0.4)
