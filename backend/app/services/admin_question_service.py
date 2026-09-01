from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.repositories import question_repo
from app.repositories.question_repo import count_questions
from app.schemas.question import BulkImportResult, QuestionIn


def bulk_import(db: Session, raw_items: list[dict]) -> BulkImportResult:
    """Validates and upserts a batch of admin-authored questions — the same
    path used for both the JSON seed files and the admin API. Invalid rows
    are skipped (not fatal) so one malformed entry can't block the rest."""
    inserted = updated = skipped = 0

    for raw in raw_items:
        try:
            item = QuestionIn.model_validate(raw)
        except ValidationError:
            skipped += 1
            continue

        result = question_repo.upsert_from_bank(db, item)
        if result == "inserted":
            inserted += 1
        else:
            updated += 1

    db.commit()
    return BulkImportResult(
        inserted=inserted, updated=updated, skipped_invalid=skipped, total_in_bank=count_questions(db)
    )
