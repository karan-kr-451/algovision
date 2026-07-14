# AlgoVision

Interactive DSA learning platform. *Visualize along with code — not after it.*

Full spec: `algovision-claude-code-spec.md`. Build guidance: `CLAUDE.md`.

**Phase 1 (current):** auth, DB schema, dashboard shell, Monaco editor, problem catalog.

## Run locally

```bash
docker compose up --build
```

- Postgres — `localhost:5432`
- User service (auth) — `localhost:8001` (docs at `/docs`)
- Problem service (catalog) — `localhost:8002` (docs at `/docs`)

Frontend runs separately (not containerized in Phase 1, for fast dev iteration):

```bash
cd frontend
npm install
npm run dev
```

Frontend at `localhost:3000`.

## Repository structure

```
/services
  /user-service        # FastAPI: auth, JWT
  /problem-service      # FastAPI: problem catalog
/frontend               # Next.js app router: dashboard, problem catalog, IDE shell
/infra/postgres         # DB init schema
```

Later phases (execution/judging, DAP-based trace visualization, recommendations, AI assistant) are scoped out per `CLAUDE.md` phase gating — see `algovision-claude-code-spec.md` §6.1.
