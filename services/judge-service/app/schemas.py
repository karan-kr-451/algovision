import uuid

from pydantic import BaseModel


class SubmissionCreate(BaseModel):
    user_id: uuid.UUID
    problem_id: uuid.UUID
    language: str = "python"
    code: str


class RunRequest(BaseModel):
    problem_id: uuid.UUID
    language: str = "python"
    code: str


class TestCaseResult(BaseModel):
    passed: bool
    runtime_ms: int
    stdout: str | None = None
    expected: str | None = None
    error: str | None = None


class SubmissionOut(BaseModel):
    id: uuid.UUID
    status: str
    runtime_ms: int | None
    memory_kb: int | None
    test_results: list[TestCaseResult]


class RunOut(BaseModel):
    all_passed: bool
    runtime_ms: int
    test_results: list[TestCaseResult]
