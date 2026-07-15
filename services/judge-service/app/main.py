import base64
import json
import uuid

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from datetime import date, timedelta

from . import schemas
from .db import Base, engine, get_db
from .models import LearningProgress, Problem, Solution, User
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


def _build_function_harness(code: str, function_name: str, args: list) -> str:
    """Wraps a LeetCode-style function-signature solution so it can run through
    the same sandbox as stdin/stdout problems: append a call to the target
    function with json/base64-encoded args, print its return value as JSON."""
    args_b64 = base64.b64encode(json.dumps(args).encode()).decode()
    return (
        code
        + "\n\nimport json, base64\n"
        + f"_args = json.loads(base64.b64decode('{args_b64}').decode())\n"
        + f"print(json.dumps({function_name}(*_args)))\n"
    )


def _build_class_harness(code: str, class_name: str, operations: list, args_list: list) -> str:
    """Wraps a stateful, multi-method 'design' solution (Trie, MedianFinder, ...):
    instantiate the class with the first operation's args, then call each
    subsequent operation in order, collecting every return value (None for the
    constructor, matching LeetCode's own judging convention for design problems)
    into a single JSON list printed at the end. Each operation's args are static
    — they can't reference an earlier operation's result (no chaining support yet)."""
    ops_b64 = base64.b64encode(json.dumps(operations).encode()).decode()
    args_b64 = base64.b64encode(json.dumps(args_list).encode()).decode()
    return (
        code
        + "\n\nimport json, base64\n"
        + f"_ops = json.loads(base64.b64decode('{ops_b64}').decode())\n"
        + f"_args = json.loads(base64.b64decode('{args_b64}').decode())\n"
        + "_results = [None]\n"
        + f"_obj = {class_name}(*_args[0])\n"
        + "for _op, _a in zip(_ops[1:], _args[1:]):\n"
        + "    _results.append(getattr(_obj, _op)(*_a))\n"
        + "print(json.dumps(_results))\n"
    )


def _update_streak(db: Session, user_id: uuid.UUID):
    """Consecutive-day streak: bump when the previous accepted day was yesterday,
    keep unchanged if already accepted today, reset to 1 otherwise."""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return
    today = date.today()
    if user.last_accepted_date == today:
        return
    user.streak = user.streak + 1 if user.last_accepted_date == today - timedelta(days=1) else 1
    user.last_accepted_date = today


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


def _execute_testcases(problem: Problem, code: str, testcases: list) -> tuple[list[schemas.TestCaseResult], str, int]:
    """Runs `code` against `testcases` in the sandbox. Shared by /run (sample
    subset, nothing recorded) and /submissions (full set, recorded) — the two
    LeetCode-style tiers: fast sample feedback vs. the judged full test suite."""
    results: list[schemas.TestCaseResult] = []
    verdict = "accepted"
    total_runtime = 0

    for tc in testcases:
        if problem.harness_type == "operations":
            harness_code = _build_class_harness(code, problem.function_name, tc["operations"], tc["args"])
            stdout, runtime_ms, error = run_in_sandbox(harness_code, "")
        elif problem.function_name:
            harness_code = _build_function_harness(code, problem.function_name, tc["args"])
            stdout, runtime_ms, error = run_in_sandbox(harness_code, "")
        else:
            stdout, runtime_ms, error = run_in_sandbox(code, tc["input"])
        total_runtime += runtime_ms

        if error == "timeout":
            verdict = "tle"
            results.append(schemas.TestCaseResult(passed=False, runtime_ms=runtime_ms, error="timeout"))
            break
        if error == "runtime_error":
            verdict = "runtime_error"
            results.append(schemas.TestCaseResult(passed=False, runtime_ms=runtime_ms, error=stdout))
            break

        if problem.harness_type in ("operations", "function"):
            expected = json.dumps(tc["expected"])
            try:
                passed = json.loads(stdout.strip()) == tc["expected"]
                actual = stdout.strip()
            except (json.JSONDecodeError, ValueError):
                passed = False
                actual = stdout.strip()
        else:
            expected = tc["output"].strip()
            actual = stdout.strip()
            passed = actual == expected

        results.append(
            schemas.TestCaseResult(passed=passed, runtime_ms=runtime_ms, stdout=actual, expected=expected)
        )
        if not passed:
            verdict = "wrong_answer"
            break

    return results, verdict, total_runtime


# Sample tests shown to the user (matches the Examples on the problem page) —
# LeetCode's "Run" checks these only; full grading happens on Submit.
SAMPLE_TESTCASE_COUNT = 3


@app.post("/run", response_model=schemas.RunOut)
def run(payload: schemas.RunRequest, db: Session = Depends(get_db)):
    problem = db.query(Problem).filter(Problem.id == payload.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    if not problem.testcases:
        raise HTTPException(status_code=400, detail="Problem has no judge-compatible testcases")

    sample = problem.testcases[:SAMPLE_TESTCASE_COUNT]
    results, verdict, total_runtime = _execute_testcases(problem, payload.code, sample)

    return schemas.RunOut(
        all_passed=(verdict == "accepted" and len(results) == len(sample)),
        runtime_ms=total_runtime,
        test_results=results,
    )


@app.post("/submissions", response_model=schemas.SubmissionOut)
def submit(payload: schemas.SubmissionCreate, db: Session = Depends(get_db)):
    problem = db.query(Problem).filter(Problem.id == payload.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    if not problem.testcases:
        raise HTTPException(status_code=400, detail="Problem has no judge-compatible testcases")

    results, verdict, total_runtime = _execute_testcases(problem, payload.code, problem.testcases)

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
    if verdict == "accepted":
        _update_streak(db, payload.user_id)

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
