# AlgoVision

Interactive DSA learning platform. *Visualize along with code — not after it.*

Full spec: `algovision-claude-code-spec.md`. Build guidance: `CLAUDE.md` (see its Phase checklist for what's built).

## Run locally

```bash
docker compose up --build
```

- Postgres — `localhost:5432`
- Redis — `localhost:6379`
- User service (auth, notepad) — `localhost:8001` (docs at `/docs`)
- Problem service (catalog) — `localhost:8002` (docs at `/docs`)
- Judge service (Run/Submit) — `localhost:8003` (docs at `/docs`)
- Trace execution service (DAP sandbox) — `localhost:8004` (docs at `/docs`)
- Visualization engine (classifier + WS) — `localhost:8005`
- Recommendation service — `localhost:8006` (docs at `/docs`)

Frontend runs separately (not containerized, for fast dev iteration):

```bash
cd frontend
npm install
npm run dev
```

Frontend at `localhost:3000`.

## Problem catalog: ingestion + test generation

Beyond the seed problems in `infra/postgres/init.sql`, `services/problem-service/ingestion/` has standalone scripts (run via `docker compose exec problem-service python ingestion/<script>.py`):

- `codeforces.py [limit]` — pulls metadata from the Codeforces API (title/tags/rating; no statement text or hidden tests — see spec §6.6a). Catalog-only, not judge-ready.
- `exercism.py [limit]` — clones `exercism/problem-specifications` (MIT), parses real canonical test data into function-signature problems. Judge-ready out of the box.
- `gen_testcases.py [count]` — generator+oracle stress-testing for our own custom problems only (the ones with a verified-correct reference solution here): random valid input + the reference solution as oracle, deduped against existing cases. Fixed seed, so re-running reproduces the same set rather than drifting. Not applicable to ingested problems we didn't solve ourselves.

## Repository structure

```
/services
  /user-service              # FastAPI: auth, JWT, notepad
  /problem-service           # FastAPI: catalog, ingestion scripts
  /judge-service             # FastAPI: sandboxed Run/Submit judging
  /trace-execution-service   # FastAPI: DAP-driven sandboxed tracing
  /visualization-engine      # FastAPI: shape classifier, WS relay
  /recommendation-service    # FastAPI: cold-start + adaptive recommendations
/frontend                    # Next.js app router: dashboard, catalog, IDE, viz panel
/infra/postgres              # DB init schema + seed data
/tests
  /trace-corpus              # shape-family scripts + pipeline test runner
  /ui                        # Playwright browser verification
```

See `CLAUDE.md`'s phase checklist and decision notes for what's built, what's deliberately descoped, and why.
