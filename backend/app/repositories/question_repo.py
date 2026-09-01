from sqlalchemy.orm import Session

from app.models.question import Question
from app.models.taxonomy import Concept, Role, Skill, Topic, slugify
from app.schemas.question import QuestionIn


def _get_or_create(db: Session, model, name: str):
    """Resolves a tag name to its row, creating it on first use — this is the
    whole point of the centralized bank: a new role/topic/skill is a new tag
    row, never a new question bank."""
    slug = slugify(name)
    existing = db.query(model).filter(model.slug == slug).first()
    if existing:
        return existing
    row = model(name=name, slug=slug)
    db.add(row)
    db.flush()
    return row


def _resolve_tags(db: Session, model, names: list[str]) -> list:
    # De-duplicate case/spacing variants of the same tag within one question
    # (e.g. ["Backend", "backend "]) by slug, so it doesn't end up linked twice.
    seen = {}
    for name in names:
        if not name.strip():
            continue
        row = _get_or_create(db, model, name)
        seen[row.id] = row
    return list(seen.values())


def get_by_id(db: Session, question_id: str) -> Question | None:
    return db.get(Question, question_id)


def list_questions(
    db: Session, *, role: str | None = None, topic: str | None = None, limit: int = 50, offset: int = 0
) -> list[Question]:
    query = db.query(Question)
    if role:
        query = query.join(Question.role_objs).filter(Role.slug == slugify(role))
    if topic:
        query = query.join(Question.topic_objs).filter(Topic.slug.contains(slugify(topic)))
    return query.offset(offset).limit(limit).all()


def count_questions(db: Session) -> int:
    return db.query(Question).count()


def increment_usage(db: Session, question_id: str) -> None:
    question = db.get(Question, question_id)
    if question:
        question.usage_count += 1
        db.flush()


def upsert_from_bank(db: Session, item: QuestionIn) -> str:
    """Insert or update a single question, resolving its tag names to
    Role/Topic/Skill/Concept rows and linking them via the many-to-many
    association tables. Returns 'inserted' or 'updated'."""
    existing = db.get(Question, item.id)

    scalar_values = dict(
        question=item.question,
        type=item.type,
        difficulty=item.difficulty,
        companies_common=item.companies_common,
        source_style=item.source_style,
        key_points=item.reference_solution.key_points,
        sample_answer=item.reference_solution.sample_answer,
        follow_up_hint=item.follow_up_hint,
        follow_up_questions=item.follow_up_questions,
        evaluation_criteria=item.evaluation_criteria,
        scoring_rubric=item.scoring_rubric,
        concept=item.concept,
        sub_concept=item.sub_concept,
        expected_reasoning=item.expected_reasoning,
        common_mistakes=item.common_mistakes,
        progressive_hints=item.progressive_hints,
        learning_objective=item.learning_objective,
        status=item.status,
    )

    role_rows = _resolve_tags(db, Role, item.roles)
    topic_rows = _resolve_tags(db, Topic, item.topics)
    skill_rows = _resolve_tags(db, Skill, item.tech_keywords)
    concept_rows = _resolve_tags(db, Concept, item.concepts)

    if existing:
        for key, value in scalar_values.items():
            setattr(existing, key, value)
        existing.version += 1
        existing.role_objs = role_rows
        existing.topic_objs = topic_rows
        existing.skill_objs = skill_rows
        existing.concept_objs = concept_rows
        return "updated"

    question = Question(id=item.id, **scalar_values)
    question.role_objs = role_rows
    question.topic_objs = topic_rows
    question.skill_objs = skill_rows
    question.concept_objs = concept_rows
    db.add(question)
    return "inserted"
