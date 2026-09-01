from sqlalchemy.orm import Session

from app.providers.llm.base import LLMProvider
from app.providers.tts.base import TTSProvider
from app.repositories import session_repo
from app.services.followup_service import rephrase_question


async def handle_voice_command(db: Session, llm: LLMProvider, *, session_question_id: str, command: str) -> str:
    """"Repeat" hands the question straight back; "rephrase" asks the LLM to
    say it differently without changing what's being asked — mirrors a real
    interviewer responding to "could you repeat/clarify that?"."""
    turn = session_repo.get_turn(db, session_question_id)
    if turn is None:
        raise ValueError(f"No such question turn: {session_question_id}")

    if command == "repeat":
        return turn.question_text
    if command == "rephrase":
        return await rephrase_question(llm, question_text=turn.question_text)

    raise ValueError(f"Unknown voice command '{command}' — expected 'repeat' or 'rephrase'")


async def synthesize_speech(tts: TTSProvider, text: str) -> bytes:
    return await tts.synthesize(text)
