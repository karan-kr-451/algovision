import uuid

from sqlalchemy import Column, String, Integer, Enum, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from .db import Base

notepad_type_enum = Enum("sketch", "text", name="notepad_content_type_enum", create_type=False)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    streak = Column(Integer, nullable=False, default=0)
    rating = Column(Integer, nullable=False, default=0)
    preferences = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notepad(Base):
    __tablename__ = "notepads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    problem_id = Column(UUID(as_uuid=True), nullable=True)  # null = global scratchpad
    content_type = Column(notepad_type_enum, nullable=False, default="text")
    content = Column(JSONB, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
