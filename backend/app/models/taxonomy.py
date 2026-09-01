"""The centralized question bank's tagging vocabulary: Role, Topic, Skill,
and Concept are the metadata dimensions a question is retrieved by — never a
reason to fork a separate question bank per role/topic/skill. Each is a
standalone entity linked to Question via a many-to-many association table
(not a tree — the spec is explicit that one question can carry many roles,
many topics, many skills, and many concepts at once).

'Skill' also stands in for what the spec calls 'Technologies' — our existing
content doesn't distinguish the two, so they're merged into one dimension
rather than fabricating a distinction the data doesn't actually have.

'Concept' is new: the table and its association exist and are fully wired,
but the current 666-question bank was authored before concept-level tagging
existed, so it starts empty. Nothing about the schema limits it to bank
authors alone — this is where finer-grained tags belong going forward.
"""

import uuid

from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def slugify(name: str) -> str:
    return "-".join(name.strip().lower().replace("_", " ").replace("-", " ").split())


question_roles = Table(
    "question_roles",
    Base.metadata,
    Column("question_id", ForeignKey("questions.id"), primary_key=True),
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
)

question_topics = Table(
    "question_topics",
    Base.metadata,
    Column("question_id", ForeignKey("questions.id"), primary_key=True),
    Column("topic_id", ForeignKey("topics.id"), primary_key=True),
)

question_skills = Table(
    "question_skills",
    Base.metadata,
    Column("question_id", ForeignKey("questions.id"), primary_key=True),
    Column("skill_id", ForeignKey("skills.id"), primary_key=True),
)

question_concepts = Table(
    "question_concepts",
    Base.metadata,
    Column("question_id", ForeignKey("questions.id"), primary_key=True),
    Column("concept_id", ForeignKey("concepts.id"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)


class Concept(Base):
    __tablename__ = "concepts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
