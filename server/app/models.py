from datetime import datetime, timezone

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ConceptModel(BaseModel):
    name: str
    description: str
    embedding: list[float]
    source_input_id: str
    user_id: str
    created_at: datetime = Field(default_factory=utc_now)


class EdgeModel(BaseModel):
    from_concept: str
    to_concept: str
    relationship_type: str
    description: str
    user_id: str


class InputModel(BaseModel):
    content: str
    content_type: str
    user_id: str
    created_at: datetime = Field(default_factory=utc_now)


class ContradictionModel(BaseModel):
    concept_a: str
    concept_b: str
    explanation: str
    user_id: str
    created_at: datetime = Field(default_factory=utc_now)
    resolved: bool = False


class ConnectionModel(BaseModel):
    concept_a: str
    concept_b: str
    explanation: str
    user_id: str
    created_at: datetime = Field(default_factory=utc_now)


class TextIngestRequest(BaseModel):
    content: str
    user_id: str
