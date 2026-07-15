import uuid

from sqlalchemy import Column, String, Text, Enum, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from .db import Base

difficulty_enum = Enum("easy", "medium", "hard", name="difficulty_enum", create_type=False)
tier_enum = Enum("core", "extended", "conceptual", name="visualization_tier_enum", create_type=False)


class Problem(Base):
    __tablename__ = "problems"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    difficulty = Column(difficulty_enum, nullable=False)
    pattern = Column(String(100), nullable=False)
    statement = Column(Text, nullable=False)
    constraints = Column(Text)
    examples = Column(JSONB, nullable=False, default=list)
    testcases = Column(JSONB, nullable=False, default=list)
    tags = Column(ARRAY(String), nullable=False, default=list)
    source = Column(String(50), nullable=False, default="custom")
    visualization_tier = Column(tier_enum, nullable=False, default="core")
    visualization_meta = Column(JSONB, nullable=False, default=dict)
    license = Column(String(50), nullable=False, default="original")
    attribution_text = Column(String(255))
    function_name = Column(String(100))
    starter_code = Column(Text)
    hints = Column(ARRAY(String), nullable=False, default=list)
    follow_up = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
