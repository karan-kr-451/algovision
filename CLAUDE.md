# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**AlgoVision** — an interactive DSA learning platform. Tagline: *"Visualize along with code — not after it."*

The core differentiator: as the user writes code, their actual execution is traced (via debugger protocols, not canned animations) and rendered live as the correct data-structure visualization — array, tree, graph, stack, DP table, etc. — inferred from the *shape* of the running data, not from any fixed per-problem script. Two different valid solutions to the same problem produce two different, equally accurate, visualizations.

Full product/technical spec: **`docs/algovision-claude-code-spec.md`** — read the relevant section before starting work on that area rather than assuming context. Section map:
- §1 PRD — goals, users, features, metrics
- §2 TRD — architecture, stack, the DAP-based tracing design, the debounced-live-typing design
- §3 Application flow — end-to-end user journey and the two data-flow pipelines
- §4 UI/UX — layout, interaction patterns, accessibility requirements
- §5 Backend schema — entities, relationships, business logic notes
- §6 Implementation plan — phases, team roles, risks, content taxonomy tiers

## Non-negotiable architectural rules

These are load-bearing decisions from the spec — don't quietly re-derive a different approach without flagging it first:

1. **Every visualization frame comes from a real execution trace.** There is no separate "static analysis" or heuristic preview path. Live-while-typing is achieved by re-running the real trace pipeline on a debounce, not by guessing from the AST. If you're tempted to add a cheaper approximate preview, stop and raise it — this was tried and explicitly rejected (see spec §2.1).
2. **Trace acquisition goes through the Debug Adapter Protocol** (`debugpy` for Python at MVP), not custom per-language AST instrumentation. One language-agnostic event schema (`{step, line, locals, call_stack}`) feeds the classifier.
3. **Execution and visualization are separate services.** Sandbox security must never be coupled to rendering/animation logic.
4. **The structure classifier infers from variable shape**, not from requiring users to write code a particular way (e.g., no manual tracer-call annotations, unlike Algorithm Visualizer). See the shape→renderer table in spec §2.1.
5. **`visualization_tier`** (`core` / `extended` / `conceptual`) gates what gets a live trace vs. a static explainer — see spec §6.4. Don't build live-trace support for Tier 3 content (Treaps, System Design, etc.) without a product decision to move it up a tier.
6. Background (typing-pause-triggered) executions run under **tighter step/time limits** than explicit Run/Submit, and are skipped entirely if static scanning finds I/O calls in the buffer.
7. **The AI Assistant is grounded in the real trace event stream** (same Kafka topic as the Visualization Engine), not just code-as-text — this is what differentiates it from every comparable extension (LeetCopilot, NeetBot, etc.). Hints default to the least specific tier and require explicit escalation; never fabricate a trace when none exists (log `trace_ref` as null instead). See spec §1.6.
8. **No "interview copilot" / real-time proctoring-evasion features, ever.** This is a stated product anti-goal, not an oversight — flag and reject any feature request that resembles it rather than building it quietly.

## Tech stack

- **Frontend:** Next.js, React, TypeScript, Tailwind, Monaco Editor, D3.js/Canvas/PixiJS, Framer Motion, WebSocket client
- **Backend:** FastAPI (Python) for core services, Node.js for realtime/WebSocket, gRPC internally
- **Trace Execution Service:** `debugpy` via DAP, sandboxed (Docker/Firecracker)
- **Data:** PostgreSQL (relational), MongoDB (trace/visualization frames), Redis (cache/sessions), Elasticsearch (problem search)
- **Infra:** Kubernetes, Docker, Terraform, GitHub Actions, Prometheus/Grafana, Sentry, OpenTelemetry

## Current phase

Check spec §6.1 for the phase list. Update this section as phases complete:

- [ ] Phase 1 — Foundation (auth, schema, dashboard shell, Monaco, problem catalog)
- [ ] Phase 2 — Execution & Judging (sandboxed Python execution, Judge0, submission pipeline)
- [ ] Phase 3 — Visualization MVP, Tier 1 (DAP integration, classifier, timeline UI)
- [ ] Phase 4 — Visualization Extended, Tier 2
- [ ] Phase 5 — Learning Platform (recommendations, mastery tracking, Notepad)
- [ ] Phase 5a — AI Assistant (trace-grounded hints, complexity coaching, edge-case generation)
- [ ] Phase 6 — Multi-language expansion
- [ ] Phase 7 — Community
- [ ] Phase 8 — Production hardening

**Do not start work on a later phase's scope until the current phase is checked off here**, unless explicitly told otherwise — the phases are sequenced deliberately (see spec §6.1 sequencing rationale).

## Repository structure

```
/services
  /user-service
  /problem-service
  /trace-execution-service      # DAP driver, sandboxing
  /visualization-engine         # shape classifier + event → renderer mapping
  /recommendation-service
  /analytics-service
  /ai-assistant-service          # trace-grounded hints, coaching, edge-case gen
/frontend
  /app                          # Next.js app router
  /components
    /ide                        # editor, visualization panel, variable inspector, timeline
    /notepad                    # sketch/text scratchpad
    /dashboard
/docs
  algovision-claude-code-spec.md
/infra                           # Terraform, k8s manifests
```

Adjust as the actual repo evolves — treat this as a starting scaffold, not a fixed contract.

## Conventions

- **Language servers/debug adapters live behind an abstraction layer** (spec §6.5) so the event schema stays stable as adapters are added — don't let `trace-execution-service` leak `debugpy`-specific types into the classifier or frontend.
- **Visualization frame data goes to MongoDB, not Postgres** — its shape varies per structure type (tree frame ≠ DP-table frame ≠ graph frame).
- **Notepad autosaves are a lightweight write path** — don't route them through the trace-event queue/Kafka; a direct debounced write is enough (spec §5.3).
- Prefer Python for MVP-phase backend work (matches the Tier 1 language rollout order in §6.3: Python → JS/Node → Java → C++).

## Testing & running

**Always run and test everything on localhost before considering any task done.** Don't just write code and assume it works — start the relevant service(s) locally, hit the endpoints/UI, and confirm actual behavior (including the trace pipeline, which is easy to get subtly wrong silently). If a service needs others running to be testable (e.g. the frontend needs the trace-execution-service up), start the full local stack rather than testing in isolation. Never treat "it compiles/type-checks" as equivalent to "it runs correctly on localhost" — always do the latter.

## Commands

_(Fill in once the repo is scaffolded — e.g. `npm run dev`, `pytest`, `docker compose up`. Keep this section current; it's the first thing a new session should be able to rely on.)_

## What not to do

- Don't hand-write per-algorithm animations (VisuAlgo/USF-style canned visualizations) — this defeats the entire product thesis. Every visualization must derive from a real trace of arbitrary user code.
- Don't require users to annotate their code to get a visualization (Algorithm Visualizer's model) — the classifier must work on plain, idiomatic code.
- Don't blend heuristic/static-analysis guesses into the live visualization display — see rule 1 above.
- Don't let the AI Assistant answer from code-as-text alone when a real trace is available — that's the exact limitation of every comparable tool it's meant to improve on.
- Don't build any real-time "assist during a live/proctored interview" capability — see rule 8 above.
