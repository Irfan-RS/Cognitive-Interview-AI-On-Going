from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.rag.embeddings import embed_texts
from app.rag.indexer import build_document, build_metadata
from app.rag.vector_store import upsert_questions
from app.repositories import question_repo
from app.schemas.question import BulkImportResult, QuestionAdminOut, QuestionIn, QuestionOut
from app.services.admin_question_service import bulk_import

router = APIRouter(prefix="/admin/questions", tags=["admin"])


@router.get("", response_model=list[QuestionOut])
def list_questions(role: str | None = None, topic: str | None = None, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    return question_repo.list_questions(db, role=role, topic=topic, limit=limit, offset=offset)


@router.get("/{question_id}", response_model=QuestionAdminOut)
def get_question(question_id: str, db: Session = Depends(get_db)):
    question = question_repo.get_by_id(db, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.post("/bulk-import", response_model=BulkImportResult)
def bulk_import_questions(items: list[QuestionIn], db: Session = Depends(get_db)):
    """Admin ingestion path: validates and upserts a batch of tagged
    questions, then re-indexes just those rows into the RAG vector store
    so they're immediately retrievable — no separate reindex step needed."""
    result = bulk_import(db, [item.model_dump() for item in items])

    questions = [question_repo.get_by_id(db, item.id) for item in items]
    questions = [q for q in questions if q is not None]
    if questions:
        documents = [build_document(q) for q in questions]
        embeddings = embed_texts(documents)
        metadatas = [build_metadata(q) for q in questions]
        upsert_questions(ids=[q.id for q in questions], embeddings=embeddings, documents=documents, metadatas=metadatas)

    return result
