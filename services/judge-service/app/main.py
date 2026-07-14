import uuid

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import schemas
from .db import Base, engine, get_db
from .models import LearningProgress, Problem, Solution
from .sandbox import run_in_sandbox

app = FastAPI(title="AlgoVision Judge Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


def _update_mastery(db: Session, user_id: uuid.UUID, pattern: str, accepted: bool):
    progress = (
        db.query(LearningProgress)
        .filter(LearningProgress.user_id == user_id, LearningProgress.pattern == pattern)
        .first()
    )
    if progress is None:
        progress = LearningProgress(user_id=user_id, pattern=pattern, attempts=0, accuracy=0, mastery_score=0)
        db.add(progress)

    prior_correct = round(progress.accuracy * progress.attempts)
    progress.attempts += 1
    progress.accuracy = (prior_correct + (1 if accepted else 0)) / progress.attempts
    # ponytail: simple accuracy-as-mastery: add a recency/attempt-count-aware formula if analytics need it
    progress.mastery_score = progress.accuracy


@app.post("/submissions", response_model=schemas.SubmissionOut)
def submit(payload: schemas.SubmissionCreate, db: Session = Depends(get_db)):
    problem = db.query(Problem).filter(Problem.id == payload.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    if not problem.testcases:
        raise HTTPException(status_code=400, detail="Problem has no judge-compatible testcases")

    results: list[schemas.TestCaseResult] = []
    verdict = "accepted"
    total_runtime = 0

    for tc in problem.testcases:
        stdout, runtime_ms, error = run_in_sandbox(payload.code, tc["input"])
        total_runtime += runtime_ms
        expected = tc["output"].strip()
        actual = stdout.strip()

        if error == "timeout":
            verdict = "tle"
            results.append(schemas.TestCaseResult(passed=False, runtime_ms=runtime_ms, error="timeout"))
            break
        if error == "runtime_error":
            verdict = "runtime_error"
            results.append(schemas.TestCaseResult(passed=False, runtime_ms=runtime_ms, error=stdout))
            break

        passed = actual == expected
        results.append(
            schemas.TestCaseResult(passed=passed, runtime_ms=runtime_ms, stdout=actual, expected=expected)
        )
        if not passed:
            verdict = "wrong_answer"
            break

    solution = Solution(
        user_id=payload.user_id,
        problem_id=payload.problem_id,
        language=payload.language,
        code=payload.code,
        runtime_ms=total_runtime,
        memory_kb=None,  # ponytail: unmeasured — python:3.12-slim has no /usr/bin/time; add if analytics need it
        status=verdict,
    )
    db.add(solution)

    _update_mastery(db, payload.user_id, problem.pattern, accepted=(verdict == "accepted"))

    db.commit()
    db.refresh(solution)

    return schemas.SubmissionOut(
        id=solution.id,
        status=solution.status,
        runtime_ms=solution.runtime_ms,
        memory_kb=solution.memory_kb,
        test_results=results,
    )


@app.get("/submissions/{submission_id}", response_model=schemas.SubmissionOut)
def get_submission(submission_id: uuid.UUID, db: Session = Depends(get_db)):
    solution = db.query(Solution).filter(Solution.id == submission_id).first()
    if not solution:
        raise HTTPException(status_code=404, detail="Submission not found")
    return schemas.SubmissionOut(
        id=solution.id,
        status=solution.status,
        runtime_ms=solution.runtime_ms,
        memory_kb=solution.memory_kb,
        test_results=[],
    )
