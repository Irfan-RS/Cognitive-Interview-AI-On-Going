"""Import every model here so Base.metadata knows about all tables when
create_all() runs — SQLAlchemy only registers a model once its module has
actually been imported."""

from app.models.answer import Answer
from app.models.monitoring import MonitoringEvent
from app.models.question import Question
from app.models.session import InterviewSession, SessionQuestion
from app.models.taxonomy import Concept, Role, Skill, Topic

__all__ = [
    "Question",
    "InterviewSession",
    "SessionQuestion",
    "Answer",
    "MonitoringEvent",
    "Role",
    "Topic",
    "Skill",
    "Concept",
]
