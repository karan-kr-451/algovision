# AlgoVision — Project Specification
### Interactive Algorithm Learning Platform (Working Title)
**Visualize along with code — not after it.**
*Prepared as a build spec for use with Claude Code*

> **How to use this doc:** Each section is meant to stand alone as context for a given slice of work. When starting a Claude Code session for a specific phase (e.g. "build the execution service"), point it at §2 (architecture/stack), §5 (schema), and the relevant row of §6.1 (phase scope) rather than pasting the whole document — that keeps the context focused on what's actually being built.

---

## 1. Product Requirements Document (PRD)

### 1.1 Vision
Most platforms teach algorithms in two disconnected steps: write code, then separately watch a video or diagram to understand what happened. AlgoVision collapses that gap. As the user codes, the editor recognizes data structures and renders a live, synced visualization — and critically, **it visualizes the user's own execution**, not a canonical textbook animation. Two different valid BFS implementations should produce two different (but each accurate) animations.

### 1.2 Problem Statement
Learners juggle 4–5 disconnected tools today: a judge (LeetCode/Codeforces), a visualizer (VisuAlgo/Python Tutor), video explanations, a debugger, and notes. Existing visualizers also only animate one canonical, hand-crafted algorithm per topic — they don't reflect what a learner's *own* code actually does. This fragmentation and rigidity slows learning and pattern intuition.

### 1.3 Target Users

| Segment | Primary Need | Key Feature Fit |
|---|---|---|
| **Beginners** (students, bootcampers) | See *why* code works, not just that it passed | Live visualization, plain-language explanations |
| **Interview candidates** (intermediate) | Learn patterns fast, track weak spots | Adaptive recommendations, performance analytics |
| **Advanced / competitive programmers** | Optimize, benchmark, custom problem sets | Complexity profiling, contest mode |
| **Educators** | Assign, track, and grade cohorts | Classroom mode, assignment + analytics dashboard |

### 1.4 Core Features (MVP → Full)
- **Smart dashboard** — streak, weak patterns, recommended next problem
- **Adaptive recommendation engine** — sequences problems by measured pattern mastery
- **Multi-language IDE** — Python first (see §6.3 for language rollout order)
- **Live Visualization Engine** (core differentiator) — traces the user's actual execution and auto-renders arrays, linked lists, trees, graphs, stacks, queues, heaps, tries, hash maps, DP tables, recursion trees
- **Variable inspector** — live key/value view synced to execution step
- **Execution timeline** — scrub backward/forward through recorded steps
- **Notepad / Scratchpad** — a freeform sketch-and-write panel alongside the IDE, for diagramming an approach by hand, jotting notes, or annotating a visualization frame before committing to code (see §1.4a)
- **AI Assistant** — trace-grounded hints, complexity coaching, edge-case generation, and AI-authored notes — grounded in the actual execution trace, not just the code as text (see §1.6)
- **Pattern detection** *(v2, not MVP)* — best-guess label of the algorithmic pattern (two-pointer, BFS, DP) as it's typed
- **Performance analysis** — measured runtime, memory, recursion depth, empirical complexity estimate
- **Contest mode & community** *(post-MVP)* — leaderboards, solution sharing, discussion threads

### 1.4a Notepad / Scratchpad (Detail)
A dedicated freeform space, separate from the code editor, for the thinking that happens *before* or *around* code — sketching a diagram of an approach, jotting a note about why a solution works, or marking up a specific visualization frame. This is distinct from the Variable Inspector and Timeline (which are read-only views of execution) and from code comments (which live inside the graded solution).

**What it needs to support:**
- **Freehand sketch/draw mode** — pen/shape tool on a blank canvas, for drawing a quick tree, graph, or pointer diagram by hand before writing code
- **Plain text/markdown notes** — for writing out an approach in words, complexity analysis, or "why this failed" reflections
- **Snapshot annotation** — pull in a static image of the *current* visualization frame and draw/write directly on top of it (e.g., circling the moment two pointers meet)
- **Scoping** — a note can be attached to a specific problem (persists when the user returns to that problem) or kept as a general/global scratchpad not tied to any one problem
- **Autosave** — since this is thinking-in-progress, not a submission, it should save continuously without an explicit save action

**What it deliberately does not need for MVP:** real-time collaboration, rich diagram-specific tooling (flowchart shapes, connectors with snapping), or version history — a plain canvas + text area covers the actual use case (fast personal sketching) without building a full diagramming product. Revisit only if usage data shows people want to share sketches with others.

### 1.5 Success Criteria / Metrics

| Category | Metric | MVP Target (Month 3 post-launch) |
|---|---|---|
| Engagement | Weekly Active Users / registered users | ≥ 30% |
| Engagement | Avg. session length | ≥ 20 minutes |
| Learning efficacy | Pattern-mastery improvement (pre/post self-assessment) | ≥ 25% lift over 4 weeks |
| Product quality | Visualization renders correctly (no crash/mismatch vs. actual trace) | ≥ 99% of executed submissions |
| Retention | 4-week retention | ≥ 35% |
| Performance | Editor → visualization latency | < 150ms per step |
| Business | Free → paid conversion (if monetized) | 3–5% |

The pattern-mastery metric is the one that actually validates the product thesis (learning while coding beats learning after coding) — track it even though it's the hardest to measure precisely.

### 1.6 AI Assistant (Detail)

**Why this is different from existing AI coding-practice tools:** every comparable tool (LeetCode-adjacent Chrome extensions, NeetCode's NeetBot, HackerRank's AI assistant) reads the problem statement and the code as text, then generates hints or feedback from that. AlgoVision's AI Assistant reads the **actual execution trace** — the same classified event stream (`{step, line, locals, call_stack}`) driving the Visualization Engine (§2.1) — so it can make precise, true statements about what the code actually did, not inferences from reading it.

**Features (MVP → later):**

| Feature | Behavior | Grounded in |
|---|---|---|
| **Progressive hints** | Escalating tiers — nudge → identify likely bottleneck → explain the specific logic gap — never jumps straight to a full solution | Problem statement + current code + latest trace + which test cases are failing |
| **Complexity coaching** | Explains time/space complexity using *measured* loop-iteration and recursion-depth counts from the trace, not a guessed complexity class | Trace event counts (§3.2, §5.1 `visualization_sessions`) |
| **Pattern-aware edge-case generation** | Generates edge cases relevant to the problem's actual pattern (empty array for two-pointer, cycle for linked-list, unbalanced input for BST) rather than generic ones | `problems.pattern` / `visualization_meta` (§5.1) |
| **AI-authored Notepad entries** *(v2)* | Drafts a note anchored to the exact visualization frame where a key insight occurred (e.g., the moment two pointers meet), for the user to edit/keep | Trace event + Notepad snapshot mechanism (§1.4a) |
| **Mock interview mode** *(post-MVP)* | Self-practice only — simulates a verbal walkthrough and asks "why" questions after a solve | Solution + trace |

**Explicit non-goal:** no real-time "interview copilot" mode that provides discreet assistance during an actual live/proctored interview (the category occupied by tools designed to evade interview-proctoring detection). This is a stated anti-goal, not just an omission — it conflicts directly with the product's thesis of building real understanding, and normalizing it would undermine trust in every other AI feature on the platform.

**Guardrails (non-negotiable, mirrors the rules in §2.1 for the trace pipeline):**
- Hints default to the **least specific tier** and require explicit user escalation to go further — never auto-jump to a full explanation or solution.
- The AI Assistant only ever answers from the real trace and problem metadata already in the system — it should not be prompted to fabricate a plausible-sounding trace when the actual one is unavailable (e.g., code didn't run successfully); in that case it says so rather than guessing.
- Model choice (hosted API vs. BYOK, à la several of the existing extensions) is an open decision — hosted is simpler for users but puts inference cost on AlgoVision; BYOK shifts cost but adds setup friction. Flag this for a product decision before Phase 5 build-out.

---

## 2. Technical Requirements Document (TRD)

### 2.1 System Architecture

```
                        ┌──────────────┐
                        │   Frontend   │  Next.js / React
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                        │ API Gateway  │  (auth, routing, rate limiting)
                        └──────┬───────┘
    ┌───────────┬──────────┼──────────┬───────────────┬───────────────┬─────────────┐
┌────▼───┐  ┌─────▼────┐ ┌──▼───────┐ ┌─▼────────────┐ ┌▼─────────────┐ ┌▼──────────┐
│ User   │  │ Problem  │ │ Trace Exec│ │ Visualization│ │ Recommend +  │ │AI Assistant│
│Service │  │ Service  │ │ Service   │ │ Engine       │ │ Analytics    │ │  Service   │
└────┬───┘  └─────┬────┘ └──┬────────┘ └─┬────────────┘ └┬─────────────┘ └┬───────────┘
     │            │          │            │               │                │
     └────────────┴────┬─────┴────────────┴───────┬───────┴────────────────┘
                  ┌─────▼─────┐              ┌──────▼──────┐
                  │ Postgres  │              │ Redis /Kafka│
                  │ MongoDB   │              │ (events,    │
                  │ (traces)  │              │ caching)    │
                  └───────────┘              └─────────────┘
                  Deployed on Kubernetes, containerized per service
```

The **AI Assistant Service** consumes the same trace event stream as the Visualization Engine (it subscribes to the same Kafka topic rather than re-deriving trace data), plus problem metadata from the Problem Service — this is what lets it ground hints and coaching in what actually executed, rather than reading code as text like comparable tools do (see §1.6). It sits behind the gateway like any other service; it does not have a privileged or bypassable path around the sandbox or the trace pipeline.

**Key architectural decision — trace acquisition via Debug Adapter Protocol (DAP), not custom AST instrumentation:**

Rather than hand-writing per-language instrumentation (parse → inject hooks → execute), the **Trace Execution Service** drives each language's existing DAP-compatible debugger programmatically:

| Language | Debugger |
|---|---|
| Python (MVP) | `debugpy` |
| JavaScript/Node | V8 Inspector Protocol |
| Java | `java-debug` |
| C++ | `lldb-vscode` / `cpptools` |

The service sets step-mode breakpoints, runs the program inside a sandbox, and on each step-event captures the current stack frame's locals and call stack. This produces one **language-agnostic event schema** — `{step, line, locals, call_stack}` — regardless of source language, so the Visualization Engine only needs to be built once, not once per language.

The **Visualization Engine** is a separate service that consumes this event stream and classifies it into a renderable structure by inspecting variable *shape*, not by requiring any particular code style from the user:

| Detected shape | Renders as |
|---|---|
| `list`/array of primitives | Array view |
| Object with `.next`/`.prev` | Linked list |
| Object with `.left`/`.right` | Binary tree |
| `dict`/map of node → list of nodes | Graph (adjacency) |
| 2D list written via nested loop indices | DP table |
| Call stack depth growing on self-referential function | Recursion tree |
| `list` used with append/pop from one end | Stack |
| `list`/deque used with append/popleft | Queue |

This is why execution and visualization are separate services: sandbox security should never be coupled to animation logic, and the classifier can be iterated on independently of the trace source.

**Key architectural decision — "live while typing" via debounced background re-execution, not static analysis:**

The product's core promise is visualizing *along with* code, not just *from* code after an explicit Run — this is the one piece of the architecture with no close prior art (Python Tutor and the VS Code DAP tooling both require an explicit run step). The mechanism is:

1. On a pause in typing (~200–500ms of no keystrokes), attempt to parse the current buffer.
2. If it parses successfully, submit it to the Trace Execution Service for a background run, using the *same* DAP pipeline as an explicit Run — there is no separate "preview" code path or static-analysis shortcut. A background run is a real trace, just triggered by a typing pause instead of a click.
3. If the buffer doesn't parse, or the background run errors/times out, **keep rendering the last successful trace** rather than clearing the visualization. The visualization should never blank out just because the user is mid-edit.
4. Only fully replace the displayed visualization once a new background run completes successfully.

This means there is no meaningfully distinct "preview" data source to keep separate from "real" trace data (an earlier draft of this spec assumed a cheaper static-analysis preview layer — that idea is retired in favor of this approach, since a lightweight guess can't actually reflect execution and would reintroduce the "showing something that didn't happen" trust problem). Every frame shown, live-while-typing or after an explicit Run, comes from the same DAP trace pipeline.

**Guards required specifically because this now runs automatically, not just on explicit user action:**

| Risk | Guard |
|---|---|
| Runaway/infinite loops hanging a background sandbox | Hard step-count and wall-clock cutoff on every background run (tighter than the limit used for explicit Run/Submit) |
| Repeated side effects (file I/O, network calls, prints) firing on every pause | Static scan for I/O-related calls before submitting a background run; if present, disable auto-run for that buffer and fall back to explicit-Run-only |
| Sandbox/queue overload from high-frequency background runs across many concurrent users | Debounce per-session (one in-flight background run at a time; a new pause cancels/supersedes an in-progress one rather than queuing both) |

### 2.2 Technology Stack

**Frontend:** Next.js, React, TypeScript, Tailwind CSS, Monaco Editor, D3.js / Canvas / PixiJS (rendering), Framer Motion (animation), native WebSocket client

**Backend:** FastAPI (Python) for core services, Node.js for the realtime/WebSocket layer, gRPC for internal service calls

**Trace Execution Service:** `debugpy` (Python, MVP) driven programmatically via DAP, running inside Docker containers or Firecracker microVMs with strict CPU/memory/network limits; Judge0 as a reference judge for correctness-checking submissions (separate concern from tracing)

**Data layer:**
- PostgreSQL — users, problems, solutions, relational data
- MongoDB — execution traces / visualization frame data (variable-shaped per structure type)
- Redis — session cache, rate limiting, leaderboard sorted sets
- Elasticsearch — problem search/filtering

**Infra:** Kubernetes, Docker, Terraform, GitHub Actions, Prometheus + Grafana, Sentry, OpenTelemetry

**Auth:** OAuth (Google, GitHub), JWT sessions

**Third-party:** Judge0, Stripe (if monetized), Cloudflare (CDN + DDoS protection)

### 2.3 Performance & Scalability Requirements

| Requirement | Target |
|---|---|
| Editor initial load | < 1s |
| Problem statement load | < 500ms |
| Visualization frame rate | 60 FPS |
| Trace event latency (debugger step → frontend render) | < 150ms |
| Concurrent active users (steady state) | 100,000+ |
| Trace Execution Service scaling | Stateless workers behind a queue (Kafka), autoscaled on queue depth |

---

## 3. Application Flow

### 3.1 End-to-End User Journey
```
Login → Dashboard → Recommended problem → Read problem statement
   → Open IDE → Write code → Run
   → Visualization renders live as code executes
   → Scrub timeline / inspect variables / debug
   → Submit → Judge0/sandbox checks against test cases
   → Performance report (runtime, memory, complexity)
   → Pattern-mastery profile updates → Next recommendation generated
```

### 3.2 Live Visualization Data Flow (debounced DAP trace, live-while-typing + explicit Run)

Two triggers feed the same pipeline — this is the important design point, so it's written out as one flow rather than two:

```
Trigger: either (a) ~200–500ms pause in typing, or (b) explicit Run click
   → Buffer parse check
       → fails to parse: keep showing last successful visualization, no new run submitted
       → parses: submit to Trace Execution Service
   → Service launches sandboxed process with DAP debugger attached (debugpy, etc.)
       → background runs (trigger a): tighter step/time cutoff, I/O-call guard applied first
       → explicit Run (trigger b): standard cutoff, full execution
   → Debugger set to step-mode; program executes
   → On each step: capture {line, locals, call_stack} from the debug adapter
   → Events streamed over WebSocket to frontend as they're produced (not batched at the end)
   → Visualization Engine's classifier inspects variable shapes in each event
   → Maps to a renderer (array/tree/graph/stack/queue/DP-table/recursion)
   → Frontend animates the frame; Timeline component appends it for later scrubbing
   → If a background run errors/times out mid-way: retain last fully-rendered good state, discard the partial failed run
```

Design rule worth encoding directly in code review/tests: **the DAP event stream is the only source of data ever rendered — there is no separate lighter-weight "preview" representation.** "Live while typing" is real execution, just triggered more often and under tighter limits; it is not a heuristic guess layered on top of the code.

### 3.3 Submission / Judging Flow
```
Submit → Sandbox provisioned → Test cases executed sequentially
   → Runtime + memory captured per test case
   → Verdict (Accepted / Wrong Answer / TLE / MLE / Runtime Error)
   → Results written to solutions table
   → learning_progress updated for the problem's pattern
   → Recommendation queue regenerated
```

---

## 4. UI/UX Brief

### 4.1 Layout
- **IDE view** (primary screen): resizable panes — Problem | Editor | Visualization | Variables/Console — with Timeline, Performance, and **Notepad** as collapsible drawers/tabs. Notepad opens as a floating or docked panel so it can sit alongside the visualization without displacing the editor as the default focus.
- **Dashboard**: continue-learning card, streak, 2–3 recommended problems, weak-pattern callouts. Keep it lightweight on first load.
- Default **dark theme**, with light-theme toggle.

### 4.2 Visual Style
Minimal, high-contrast, generously spaced. Every animation must map to a real event in the trace — motion should never be decorative, or it undermines trust in the tool's accuracy.

### 4.3 Interaction Patterns
- Visualization panel auto-switches per detected structure, with a subtle label (e.g., "Array — Two Pointer") so users learn to recognize patterns themselves.
- Timeline: click-drag or arrow-key stepping, speed control 0.5x–5x.
- Hover-to-inspect on any visualized element (array cell, tree node).
- Run always reachable via keyboard shortcut (Cmd/Ctrl+Enter).
- **Notepad**: toggle between sketch mode (pen/shape tool on canvas) and text mode (markdown) via a simple tab, not a mode dialog; a one-click "snapshot" action pulls the current visualization frame into the sketch canvas as a background image to annotate over. Saves continuously — no explicit save button.

### 4.4 Accessibility
- Full keyboard navigation for editor, timeline, dashboard, and notepad text mode (freehand sketch mode is inherently pointer-based, so ensure the text-note mode alone is fully usable without a mouse/trackpad)
- Screen-reader labels on visualization elements (e.g., "array index 2, value 8, pointer: right")
- High-contrast theme, adjustable font scaling
- Colorblind-safe palette (pair color with shape/label, not color alone)
- Reduced-motion setting: instant state updates instead of animated transitions

---

## 5. Backend Schema

### 5.1 Core Entities

**users**
```
id            uuid PK
name          varchar
email         varchar unique
password_hash varchar
streak        int
rating        int
preferences   jsonb
created_at    timestamp
```

**problems**
```
id                  uuid PK
title               varchar
difficulty          enum(easy, medium, hard)
pattern             varchar          -- e.g. "two_pointer", "dp", "bfs" (see §6.4 taxonomy)
statement           text
constraints         text
examples            jsonb
testcases           jsonb            -- or S3 reference for large sets
tags                text[]
source              varchar          -- "codeforces" | "cses" | "custom" | ...
visualization_tier  enum(core, extended, conceptual)  -- see §6.4
visualization_meta  jsonb            -- {array: true, pointer: true, tree: false, ...}
```

**solutions**
```
id            uuid PK
user_id       uuid FK -> users.id
problem_id    uuid FK -> problems.id
language      varchar
code          text
runtime_ms    int
memory_kb     int
status        enum(accepted, wrong_answer, tle, mle, runtime_error)
created_at    timestamp
```

**visualization_sessions**  (Mongo — variable-shaped event data)
```
id             uuid PK
solution_id    uuid FK -> solutions.id
frames         array<object>   -- ordered {line, locals, call_stack} events from the debug adapter
structure_type varchar
duration_ms    int
```

**learning_progress**
```
user_id       uuid FK -> users.id
pattern       varchar
mastery_score float          -- 0.0–1.0
attempts      int
accuracy      float
avg_speed_ms  int
PRIMARY KEY (user_id, pattern)
```

**notepads**
```
id            uuid PK
user_id       uuid FK -> users.id
problem_id    uuid FK -> problems.id, nullable   -- null = global/general scratchpad, not tied to a problem
content_type  enum(sketch, text)
content       jsonb            -- sketch: vector stroke data + optional background snapshot image ref; text: markdown string
updated_at    timestamp
```

**ai_interactions**
```
id                uuid PK
user_id           uuid FK -> users.id
problem_id        uuid FK -> problems.id
solution_id       uuid FK -> solutions.id, nullable   -- present once a solution exists to ground the interaction in
interaction_type  enum(hint, complexity_coaching, edge_case_gen, notepad_draft, mock_interview)
hint_tier         int, nullable       -- escalation level reached, for hint interactions
trace_ref         uuid FK -> visualization_sessions.id, nullable  -- which trace grounded this response, if any
created_at        timestamp
```

**achievements**, **discussion_posts**, **contests** — standard relational entities, same FK pattern.

### 5.2 Relationships
```
users 1───∞ solutions ∞───1 problems
solutions 1───1 visualization_sessions
users 1───∞ learning_progress (one row per pattern)
users 1───∞ notepads ∞───1 problems (nullable FK — global notepads have no problem)
users 1───∞ ai_interactions ∞───1 problems
ai_interactions ∞───1 visualization_sessions (nullable — the trace an interaction was grounded in)
problems ∞───∞ tags
```

### 5.3 Business Logic Notes
- `mastery_score` recomputes on every accepted submission — near-real-time, not batch, since it drives recommendations.
- `visualization_tier` gates which UI the frontend loads: `core` → full live trace visualizer; `extended` → live trace with more complex renderer; `conceptual` → static explainer content, no trace attempted (see §6.4).
- `notepads.content` is autosaved on a debounce (similar cadence to the live-trace re-execution in §2.1, but with no execution involved — just a plain write), so treat it as a lightweight, frequent-write path; don't route it through the same queue as trace events.
- `ai_interactions.trace_ref` should be null, not a fabricated reference, whenever the AI Assistant answers without a real trace available (e.g., code didn't run yet) — this keeps the guardrail in §1.6 ("never fabricate a plausible trace") enforceable at the data level, not just as a prompting convention.
- Visualization frames live in MongoDB because shape varies wildly by structure type (a tree frame ≠ a DP-table frame).
- Large `testcases` sets go to S3 with a Postgres reference, not inline JSON.

---

## 6. Implementation Plan

### 6.1 Phased Roadmap

| Phase | Duration | Focus | Deliverable |
|---|---|---|---|
| 1. Foundation | Weeks 1–4 | Auth, DB schema, dashboard shell, Monaco integration, initial problem catalog | Users can log in, browse problems, write code |
| 2. Execution & Judging | Weeks 5–8 | Sandboxed execution (Python), Judge0 integration, submission pipeline, runtime/memory capture | Reliable online judge, Python only |
| 3. Visualization MVP (Tier 1 — see §6.4) | Weeks 9–16 | DAP integration (`debugpy`), event streaming, classifier for array/stack/queue/list/tree/recursion/DP, timeline UI | Live trace visualization for the core Tier 1 structures |
| 4. Visualization Extended (Tier 2) | Weeks 17–22 | Graphs (BFS/DFS/Dijkstra/Union-Find), advanced DP, heaps, tries, complexity overlays | Broader algorithm coverage |
| 5. Learning Platform | Weeks 23–26 | Recommendation engine, mastery tracking, streaks, Notepad (sketch + text, per-problem and global) | Personalized learning loop |
| 5a. AI Assistant | Weeks 27–30 | AI Assistant Service (§1.6/§2.1): trace-grounded progressive hints, complexity coaching, pattern-aware edge-case generation | Hint/coaching features live, gated behind the escalation-tier guardrail |
| 6. Multi-language expansion | Weeks 31–34 | Add JS/Node, then Java, then C++ debug adapters | Multi-language tracing |
| 7. Community | Weeks 35–38 | Discussions, leaderboards, contests | Engagement features |
| 8. Production Hardening | Weeks 39–42 | Perf tuning, security audit, monitoring, load testing, staged rollout | Production-ready public beta |

**Sequencing rationale:** the DAP-based trace pipeline (Phase 3) is the highest-uncertainty, highest-value component — it should be validated with real usage before investing in Tier 2 coverage, additional languages, or community features. The AI Assistant is deliberately sequenced *after* Phase 5 rather than earlier, since it depends on a stable, well-populated trace/schema foundation (`visualization_sessions`, `learning_progress`) to ground its responses in — building it earlier risks it falling back to reading code as text, which is the exact limitation it's meant to avoid (§1.6).

### 6.2 Team Roles

| Role | Responsibility |
|---|---|
| Product Manager | Roadmap, prioritization, success-metric ownership |
| Tech Lead | Architecture decisions, cross-service consistency |
| Backend Engineers (2–3) | Services, APIs, database design |
| Trace/Visualization Engineer (dedicated) | DAP integration, event classifier, renderer logic |
| AI Assistant Engineer | Hint/coaching prompt design, trace-grounding pipeline, escalation-tier enforcement |
| Frontend Engineers (2) | IDE shell, dashboard, visualization UI integration |
| DevOps/SRE | Infra, CI/CD, sandbox security, autoscaling |
| QA Engineer | Execution-correctness and visualization-accuracy regression tests |
| UI/UX Designer | Interaction design, accessibility |
| Security Engineer | Sandbox isolation, auth hardening, code-injection review |

### 6.3 Language Rollout Order
Python (MVP, `debugpy`) → JavaScript/Node (V8 Inspector) → Java (`java-debug`) → C++ (`lldb-vscode`). Each addition is scoped as its own milestone since each debug adapter has different quirks in how it reports locals and call stacks.

### 6.4 Content Taxonomy & Visualization Tiers
Full DSA taxonomy (30 categories) is retained for tagging/search, but scoped into three tiers so the visualization engine's scope stays bounded:

**Tier 1 — `core` (MVP, Phase 3):** Arrays, Strings, Hashing, Stack, Queue/Deque, Linked List, Trees (traversal/BFS/DFS/BST), Binary Search, Recursion & Backtracking, Heap, Graphs (BFS/DFS/Dijkstra/Union-Find), Trie, DP (1D/2D/grid/knapsack/LCS/LIS), Greedy, Sorting, Bit Manipulation. These map cleanly to the shape-based classifier in §2.1.

**Tier 2 — `extended` (Phase 4):** Advanced graph theory (SCC, Tarjan, Kosaraju, bridges, flow), advanced DP (digit/bitmask/profile/interval/tree DP), Range Query structures (Segment Tree, Fenwick Tree, Sparse Table), Mathematics, Geometry. Traceable via the same DAP pipeline, but need more intricate renderer logic (e.g., a segment tree update touching O(log n) nodes per operation).

**Tier 3 — `conceptual` (separate content track, not the trace visualizer):** Treap, Skip List, Splay Tree, Rope, LSM Tree, Bloom Filter, KD/Quad Tree, plus System Design, OOD, LLD/HLD, Concurrency, SQL, OS, Networks, CP techniques. These either have internal state that isn't meaningfully traceable frame-by-frame, or aren't code-execution content at all — serve as static explainers/diagrams, not live traces, to avoid quietly reintroducing hand-crafted per-structure animations.

### 6.5 Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Running untrusted user code safely | Containerized/microVM sandboxes, strict CPU/memory/network limits, no outbound network access |
| Visualization showing something that didn't actually happen | Every rendered frame comes from a real DAP trace (§2.1, §3.2) — no separate static/heuristic preview path exists to fall out of sync with reality |
| **Background re-execution on typing pauses overloading sandbox capacity or firing side effects repeatedly (no close prior art for this — highest-risk, least-validated item in the build)** | Tighter step/time cutoffs for background runs than explicit Run; I/O-call static scan disables auto-run per buffer; one in-flight background run per session, superseded rather than queued (§2.1) |
| Debug-adapter quirks differ per language | Roll out one language at a time (§6.3); build an adapter abstraction layer so the classifier/event schema stays stable even as adapters change underneath |
| Tier 2/3 scope creep into the trace visualizer | Enforce `visualization_tier` at the schema level (§5.3) so product decisions about what gets a live trace vs. a static explainer are explicit, not ad hoc |
| Concurrency at scale | Stateless services, queue-based dispatch, Redis caching, autoscaling on compute-heavy services |
| Problem-content legality | Codeforces API, CSES, Exercism, Project Euler, plus original content; no scraping/redistribution of proprietary banks |
| Recommendation cold-start | Fixed easy→medium diagnostic sequence for first ~10 problems before switching to adaptive scoring |
| AI hints spoiling the solution or over-helping | Hard escalation-tier default (§1.6) enforced server-side, not just via prompting; log `hint_tier` reached per interaction (§5.1 `ai_interactions`) to audit whether hints are being over-used |
| AI Assistant fabricating trace details when no real trace exists | `trace_ref` must be null (not invented) when ungrounded (§5.3); Assistant explicitly states it can't ground a response rather than guessing |
| Product drifting toward "interview copilot" territory (real-time cheat-assist during proctored interviews) | Stated as an explicit anti-goal (§1.6), not left as an implicit boundary — any feature proposal resembling this should be flagged and rejected in review, not quietly built |
| Inference cost / latency for AI features at scale | Decide hosted-API vs. BYOK model before Phase 5a build-out (§1.6); cache/reuse hint responses for identical trace+problem combinations where reasonable |

### 6.6 Problem Database Strategy
- **Codeforces** (20,000+, public API) — broad competitive coverage
- **CSES** (~300) — clean, pattern-organized, interview-focused
- **Exercism** (thousands, multi-language) — beginner-friendly
- **Project Euler / Rosalind** — math/bioinformatics-flavored
- **Original problems** — built to showcase specific visualization types and fill pattern gaps

All sources normalize into the `problems` schema (§5.1) with `pattern`, `visualization_tier`, and `visualization_meta` — content is organized by pattern, not by source.

---

*Living document. Expect Phase 3 (Tier 1 visualization MVP) to surface real constraints in the DAP-based approach — revisit Phase 4–8 timelines and scope once that's shipped and in front of real users.*
