from datetime import datetime, timezone

from sqlalchemy import JSON, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UTCDateTime
from app.models.taxonomy import Concept, Role, Skill, Topic, question_concepts, question_roles, question_skills, question_topics

_DIFFICULTY_LABELS = {1: "beginner", 2: "easy", 3: "medium", 4: "hard", 5: "advanced"}


class Question(Base):
    """A single question in the ONE centralized bank. Roles/topics/skills/
    concepts are many-to-many tags (see app.models.taxonomy) — never a reason
    to fork a separate bank per role or skill. Populated by the admin
    ingestion pipeline (scripts/seed_questions.py) from
    data/question_bank/*.json — never edited by candidates at runtime."""

    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # coding|system_design|theory|behavioral|scenario|...
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5

    companies_common: Mapped[list[str]] = mapped_column(JSON, default=list)
    source_style: Mapped[str] = mapped_column(String, default="common-interview")

    key_points: Mapped[list[str]] = mapped_column(JSON, default=list)  # aka "key_concepts"/"important_points"
    sample_answer: Mapped[str] = mapped_column(Text, default="")
    follow_up_hint: Mapped[str] = mapped_column(Text, default="")

    # Pre-authored candidate follow-ups (distinct from the ones followup_service
    # generates fresh from a candidate's actual transcript at runtime) — a real
    # bank question can suggest these, e.g. for use when there's no transcript
    # to ground a generated follow-up against.
    follow_up_questions: Mapped[list[str]] = mapped_column(JSON, default=list)

    # What a good answer must cover, and how it's scored — see
    # app.services.evaluation_defaults for the universal fallback used when a
    # question hasn't been individually authored with its own overrides yet.
    evaluation_criteria: Mapped[list[str]] = mapped_column(JSON, default=list)
    scoring_rubric: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)

    # Quality/lifecycle metadata (spec section 16).
    status: Mapped[str] = mapped_column(String, default="verified")  # draft | verified | deprecated
    version: Mapped[int] = mapped_column(Integer, default=1)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=lambda: datetime.now(timezone.utc))

    role_objs: Mapped[list[Role]] = relationship(secondary=question_roles)
    topic_objs: Mapped[list[Topic]] = relationship(secondary=question_topics)
    skill_objs: Mapped[list[Skill]] = relationship(secondary=question_skills)
    concept_objs: Mapped[list[Concept]] = relationship(secondary=question_concepts)

    # Read-compatible list[str] views over the relational tags — every existing
    # consumer (embeddings, schemas, the retriever) reads tags this way, and
    # rewriting every call site to walk ORM relationship objects instead would
    # buy nothing; the storage underneath is genuinely relational now, this is
    # just the ergonomic read surface for it.
    @property
    def roles(self) -> list[str]:
        return [r.name for r in self.role_objs]

    @property
    def topics(self) -> list[str]:
        return [t.name for t in self.topic_objs]

    @property
    def tech_keywords(self) -> list[str]:
        """Skills/technologies tag list — named tech_keywords for backward
        compatibility with the existing data/question_bank/*.json field name."""
        return [s.name for s in self.skill_objs]

    @property
    def concepts(self) -> list[str]:
        return [c.name for c in self.concept_objs]

    @property
    def difficulty_label(self) -> str:
        return _DIFFICULTY_LABELS.get(self.difficulty, "medium")
