import uuid

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import schemas
from .db import Base, engine, get_db
from .models import Problem

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AlgoVision Problem Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/problems", response_model=list[schemas.ProblemSummary])
def list_problems(pattern: str | None = None, difficulty: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Problem)
    if pattern:
        query = query.filter(Problem.pattern == pattern)
    if difficulty:
        query = query.filter(Problem.difficulty == difficulty)
    return query.order_by(Problem.created_at).all()


@app.get("/problems/{problem_id}", response_model=schemas.ProblemDetail)
def get_problem(problem_id: uuid.UUID, db: Session = Depends(get_db)):
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem
