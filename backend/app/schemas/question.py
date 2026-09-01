from pydantic import BaseModel, ConfigDict, Field


class ReferenceSolution(BaseModel):
    key_points: list[str] = Field(default_factory=list)
    sample_answer: str = ""


class QuestionIn(BaseModel):
    """Shape accepted by the admin bulk-import endpoint and the seed script —
    matches data/question_bank/*.json exactly. roles/topics/tech_keywords are
    stored relationally (see app.models.taxonomy) but still authored here as
    plain name lists — the ingestion pipeline resolves each name to a
    Role/Topic/Skill row, creating it on first use."""

    id: str
    question: str
    type: str
    difficulty: int = Field(ge=1, le=5)
    roles: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    tech_keywords: list[str] = Field(default_factory=list)
    concepts: list[str] = Field(default_factory=list)
    companies_common: list[str] = Field(default_factory=list)
    source_style: str = "common-interview"
    reference_solution: ReferenceSolution = Field(default_factory=ReferenceSolution)
    follow_up_hint: str = ""
    follow_up_questions: list[str] = Field(default_factory=list)
    evaluation_criteria: list[str] = Field(default_factory=list)
    scoring_rubric: dict[str, str] = Field(default_factory=dict)
    status: str = "verified"

    # Cognitive scaffolding — optional so the existing bank still imports, but
    # a question authored with these grades far more consistently.
    concept: str = ""
    sub_concept: str = ""
    expected_reasoning: str = ""
    common_mistakes: list[str] = Field(default_factory=list)
    progressive_hints: list[str] = Field(default_factory=list)
    learning_objective: str = ""


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question: str
    type: str
    difficulty: int
    difficulty_label: str
    roles: list[str]
    topics: list[str]
    tech_keywords: list[str]
    concepts: list[str]
    source_style: str


class QuestionAdminOut(QuestionOut):
    companies_common: list[str]
    key_points: list[str]
    sample_answer: str
    follow_up_hint: str
    follow_up_questions: list[str]
    evaluation_criteria: list[str]
    scoring_rubric: dict[str, str]
    concept: str
    sub_concept: str
    expected_reasoning: str
    common_mistakes: list[str]
    progressive_hints: list[str]
    learning_objective: str
    status: str
    version: int
    usage_count: int


class BulkImportResult(BaseModel):
    inserted: int
    updated: int
    skipped_invalid: int
    total_in_bank: int
