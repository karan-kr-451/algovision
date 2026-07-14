import uuid
from typing import Any

from pydantic import BaseModel


class ProblemSummary(BaseModel):
    id: uuid.UUID
    title: str
    difficulty: str
    pattern: str
    tags: list[str]
    visualization_tier: str

    class Config:
        from_attributes = True


class ProblemDetail(ProblemSummary):
    statement: str
    constraints: str | None
    examples: list[Any]
    visualization_meta: dict
    license: str
    attribution_text: str | None
    function_name: str | None
    starter_code: str | None

    class Config:
        from_attributes = True
