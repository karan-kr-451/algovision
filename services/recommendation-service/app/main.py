"""
Recommendation service (Phase 5): ranks the next problems for a user.

Strategy (spec §6.5 cold-start row + §5.3):
- Cold start (fewer than 10 attempts total): fixed easy→medium diagnostic
  sequence — easy problems first, ordered by creation, unsolved only.
- Adaptive: prefer unsolved problems whose pattern has the LOWEST mastery
  (weakest patterns first), easy→medium→hard within a pattern.
"""
import os
import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://algovision:algovision@localhost:5432/algovision"
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

COLD_START_ATTEMPTS = 10

app = FastAPI(title="AlgoVision Recommendation Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/recommendations/{user_id}")
def recommend(user_id: uuid.UUID, limit: int = 3):
    with engine.connect() as conn:
        total_attempts = conn.execute(
            text("SELECT COALESCE(SUM(attempts), 0) FROM learning_progress WHERE user_id = :u"),
            {"u": str(user_id)},
        ).scalar()

        if total_attempts < COLD_START_ATTEMPTS:
            rows = conn.execute(text("""
                SELECT p.id, p.title, p.difficulty, p.pattern
                FROM problems p
                WHERE p.testcases != '[]'::jsonb
                  AND NOT EXISTS (
                    SELECT 1 FROM solutions s
                    WHERE s.problem_id = p.id AND s.user_id = :u AND s.status = 'accepted')
                ORDER BY CASE p.difficulty WHEN 'easy' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                         p.created_at
                LIMIT :n
            """), {"u": str(user_id), "n": limit}).mappings().all()
            mode = "cold_start"
        else:
            rows = conn.execute(text("""
                SELECT p.id, p.title, p.difficulty, p.pattern
                FROM problems p
                LEFT JOIN learning_progress lp
                  ON lp.pattern = p.pattern AND lp.user_id = :u
                WHERE p.testcases != '[]'::jsonb
                  AND NOT EXISTS (
                    SELECT 1 FROM solutions s
                    WHERE s.problem_id = p.id AND s.user_id = :u AND s.status = 'accepted')
                ORDER BY COALESCE(lp.mastery_score, 0.5) ASC,
                         CASE p.difficulty WHEN 'easy' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                         p.created_at
                LIMIT :n
            """), {"u": str(user_id), "n": limit}).mappings().all()
            mode = "adaptive"

    return {
        "mode": mode,
        "problems": [
            {"id": str(r["id"]), "title": r["title"], "difficulty": r["difficulty"], "pattern": r["pattern"]}
            for r in rows
        ],
    }


@app.get("/weak-patterns/{user_id}")
def weak_patterns(user_id: uuid.UUID, limit: int = 3):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT pattern, mastery_score, attempts
            FROM learning_progress
            WHERE user_id = :u AND attempts > 0
            ORDER BY mastery_score ASC
            LIMIT :n
        """), {"u": str(user_id), "n": limit}).mappings().all()
    return {
        "patterns": [
            {"pattern": r["pattern"], "mastery_score": r["mastery_score"], "attempts": r["attempts"]}
            for r in rows
        ]
    }
