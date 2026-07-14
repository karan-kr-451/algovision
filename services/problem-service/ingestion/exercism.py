"""
Clones exercism/problem-specifications (MIT-licensed) and ingests exercises
as function-signature (LeetCode-style) problems: canonical-data.json's cases
give real args/expected pairs and a function name for free, straight from a
license-clean source (see spec §6.6a).

Only exercises with a single canonical `property` (function name) across all
cases are ingested — a handful of exercises test multiple properties, which
doesn't fit the single-function harness judge-service uses; skipped rather
than guessed at.

Usage: python ingestion/exercism.py [limit]
"""
import json
import subprocess
import sys
import tempfile
import tomllib
from pathlib import Path

from psycopg2.extras import Json

from common import get_connection, insert_problem

REPO_URL = "https://github.com/exercism/problem-specifications"
MAX_CASES_PER_PROBLEM = 5


def clone_repo(dest: Path):
    subprocess.run(
        ["git", "clone", "--depth", "1", REPO_URL, str(dest)],
        check=True, capture_output=True,
    )


def load_exercise(exercise_dir: Path):
    canonical_path = exercise_dir / "canonical-data.json"
    instructions_path = exercise_dir / "instructions.md"
    metadata_path = exercise_dir / "metadata.toml"
    if not (canonical_path.exists() and instructions_path.exists() and metadata_path.exists()):
        return None

    canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
    cases = [c for c in canonical.get("cases", []) if "expected" in c and "input" in c]
    if not cases:
        return None

    properties = {c.get("property") for c in cases}
    if len(properties) != 1 or None in properties:
        return None  # multi-property exercise — doesn't fit the single-function harness

    function_name = properties.pop()
    metadata = tomllib.loads(metadata_path.read_text(encoding="utf-8"))

    param_names = list(cases[0]["input"].keys())
    testcases = [
        {"args": list(c["input"].values()), "expected": c["expected"]}
        for c in cases[:MAX_CASES_PER_PROBLEM]
    ]
    starter_code = f"def {function_name}({', '.join(param_names)}):\n    pass\n"

    return {
        "title": metadata.get("title", exercise_dir.name),
        "statement": instructions_path.read_text(encoding="utf-8"),
        "function_name": function_name,
        "starter_code": starter_code,
        "testcases": testcases,
        "slug": exercise_dir.name,
    }


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 20

    with tempfile.TemporaryDirectory() as tmp:
        repo_dir = Path(tmp) / "problem-specifications"
        clone_repo(repo_dir)

        exercises_dir = repo_dir / "exercises"
        conn = get_connection()
        inserted, skipped_existing, skipped_unusable = 0, 0, 0
        try:
            for exercise_dir in sorted(exercises_dir.iterdir()):
                if not exercise_dir.is_dir() or inserted >= limit:
                    continue
                parsed = load_exercise(exercise_dir)
                if not parsed:
                    skipped_unusable += 1
                    continue
                ok = insert_problem(
                    conn,
                    title=parsed["title"],
                    difficulty="easy",  # metadata.toml doesn't reliably carry difficulty
                    pattern="exercism",
                    statement=parsed["statement"],
                    constraints=None,
                    examples=Json([]),
                    testcases=Json(parsed["testcases"]),
                    tags=[parsed["slug"]],
                    source="exercism",
                    visualization_tier="core",
                    visualization_meta=Json({}),
                    license="mit",
                    attribution_text=f"exercism/problem-specifications: {parsed['slug']}",
                    function_name=parsed["function_name"],
                    starter_code=parsed["starter_code"],
                )
                inserted += ok
                skipped_existing += not ok
            conn.commit()
        finally:
            conn.close()

    print(
        f"exercism: inserted {inserted}, skipped {skipped_existing} already-present, "
        f"skipped {skipped_unusable} unusable (missing files or multi-property)"
    )


if __name__ == "__main__":
    main()
