from sqlalchemy.orm import Session

from app.models.answer import Answer


def create_answer(db: Session, **fields) -> Answer:
    answer = Answer(**fields)
    db.add(answer)
    db.flush()
    return answer


def get_by_session_question(db: Session, session_question_id: str) -> Answer | None:
    return db.query(Answer).filter(Answer.session_question_id == session_question_id).first()
