from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import uuid
from typing import Any

from pydantic import BaseModel

from . import auth, schemas
from .db import Base, engine, get_db
from .models import Notepad, User

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AlgoVision User Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=auth.hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not auth.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = auth.create_access_token(subject=str(user.id))
    return schemas.Token(access_token=token)


@app.get("/users/me", response_model=schemas.UserOut)
def read_me(current_user: User = Depends(auth.get_current_user)):
    return current_user


# ---- Notepad (Phase 5). Lightweight direct write path — deliberately NOT
# routed through the trace-event queue (spec §5.3); autosave debouncing
# happens client-side, this is a plain upsert.

class NotepadPayload(BaseModel):
    problem_id: uuid.UUID | None = None
    content_type: str = "text"
    content: dict[str, Any]


class NotepadOut(BaseModel):
    problem_id: uuid.UUID | None
    content_type: str
    content: dict[str, Any]

    class Config:
        from_attributes = True


@app.get("/notepads", response_model=list[NotepadOut])
def get_notepads(
    problem_id: uuid.UUID | None = None,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Notepad).filter(Notepad.user_id == current_user.id)
    query = query.filter(Notepad.problem_id == problem_id) if problem_id else query.filter(Notepad.problem_id.is_(None))
    return query.all()


@app.put("/notepads", response_model=NotepadOut)
def upsert_notepad(
    payload: NotepadPayload,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if payload.content_type not in ("sketch", "text"):
        raise HTTPException(status_code=400, detail="content_type must be sketch or text")
    pad = (
        db.query(Notepad)
        .filter(
            Notepad.user_id == current_user.id,
            Notepad.problem_id == payload.problem_id if payload.problem_id else Notepad.problem_id.is_(None),
            Notepad.content_type == payload.content_type,
        )
        .first()
    )
    if pad is None:
        pad = Notepad(
            user_id=current_user.id,
            problem_id=payload.problem_id,
            content_type=payload.content_type,
        )
        db.add(pad)
    pad.content = payload.content
    db.commit()
    db.refresh(pad)
    return pad
