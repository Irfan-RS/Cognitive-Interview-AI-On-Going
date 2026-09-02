from pydantic import BaseModel, Field


class ResumeProject(BaseModel):
    title: str
    description: str


class ResumeParseResponse(BaseModel):
    keywords: list[str] = Field(default_factory=list)
    sections_found: list[str] = Field(default_factory=list)
    projects: list[ResumeProject] = Field(default_factory=list)
