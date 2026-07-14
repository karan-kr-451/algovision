import uuid

from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from .db import Base


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
