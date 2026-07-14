"""
Pulls problem metadata from the Codeforces public API.

License: the API returns metadata only (title, tags, rating) — not full
statement text or hidden test cases, which live only on the web page / judge
and aren't exposed via API (see spec §6.6a). So this stores a link to the
original problem plus a short honest placeholder statement, not a reproduced
statement, and leaves testcases empty (author real ones separately before a
problem is judge-runnable). license=proprietary-link-only.

Usage: python ingestion/codeforces.py [limit]
"""
import json
import sys
import urllib.request

from psycopg2.extras import Json

from common import get_connection, insert_problem

API_URL = "https://codeforces.com/api/problemset.problems"


def difficulty_for_rating(rating):
    if rating is None:
        return "medium"
    if rating < 1200:
        return "easy"
    if rating < 1900:
        return "medium"
    return "hard"


def fetch_problems():
    with urllib.request.urlopen(API_URL, timeout=30) as resp:
        data = json.load(resp)
    if data["status"] != "OK":
        raise RuntimeError(f"Codeforces API error: {data}")
    return data["result"]["problems"]


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    problems = fetch_problems()[:limit]

    conn = get_connection()
    inserted, skipped = 0, 0
    try:
        for p in problems:
            contest_id, index, name = p.get("contestId"), p.get("index"), p["name"]
            url = f"https://codeforces.com/problemset/problem/{contest_id}/{index}"
            tags = p.get("tags", [])
            ok = insert_problem(
                conn,
                title=f"{name} (CF {contest_id}{index})",
                difficulty=difficulty_for_rating(p.get("rating")),
                pattern=tags[0] if tags else "general",
                statement=(
                    f"Full statement not reproduced here — Codeforces' API provides "
                    f"metadata only, not statement text (see spec §6.6a). "
                    f"Read the problem at {url}."
                ),
                constraints=None,
                examples=Json([]),
                testcases=Json([]),  # no hidden tests available via API; author these separately
                tags=tags,
                source="codeforces",
                visualization_tier="core",
                visualization_meta=Json({}),
                license="proprietary-link-only",
                attribution_text=url,
            )
            inserted += ok
            skipped += not ok
        conn.commit()
    finally:
        conn.close()

    print(f"codeforces: inserted {inserted}, skipped {skipped} already-present (of {len(problems)} fetched)")


if __name__ == "__main__":
    main()
