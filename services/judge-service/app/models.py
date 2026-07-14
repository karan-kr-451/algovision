import uuid

from sqlalchemy import Column, String, Text, Integer, Float, Enum, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from .db import Base

status_enum = Enum(
    "accepted", "wrong_answer", "tle", "mle", "runtime_error",
    name="solution_status_enum", create_type=False,
)


class Problem(Base):
    __tablename__ = "problems"

    id = Column(UUID(as_uuid=True), primary_key=True)
    pattern = Column(String(100), nullable=False)
    testcases = Column(JSONB, nullable=False, default=list)
    function_name = Column(String(100))


class Solution(Base):
    __tablename__ = "solutions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    problem_id = Column(UUID(as_uuid=True), nullable=False)
    language = Column(String(50), nullable=False)
    code = Column(Text, nullable=False)
    runtime_ms = Column(Integer)
    memory_kb = Column(Integer)
    status = Column(status_enum)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LearningProgress(Base):
    __tablename__ = "learning_progress"

    user_id = Column(UUID(as_uuid=True), primary_key=True)
    pattern = Column(String(100), primary_key=True)
    mastery_score = Column(Float, nullable=False, default=0)
    attempts = Column(Integer, nullable=False, default=0)
    accuracy = Column(Float, nullable=False, default=0)
    avg_speed_ms = Column(Integer, nullable=False, default=0)
