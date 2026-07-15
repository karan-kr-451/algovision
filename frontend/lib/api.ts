export const USER_API = process.env.NEXT_PUBLIC_USER_API ?? "http://localhost:8001";
export const PROBLEM_API = process.env.NEXT_PUBLIC_PROBLEM_API ?? "http://localhost:8002";
export const JUDGE_API = process.env.NEXT_PUBLIC_JUDGE_API ?? "http://localhost:8003";
export const TRACE_API = process.env.NEXT_PUBLIC_TRACE_API ?? "http://localhost:8004";
export const VIZ_WS = process.env.NEXT_PUBLIC_VIZ_WS ?? "ws://localhost:8005";
export const REC_API = process.env.NEXT_PUBLIC_REC_API ?? "http://localhost:8006";

export type ProblemSummary = {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  pattern: string;
  tags: string[];
  visualization_tier: "core" | "extended" | "conceptual";
};

export type ProblemExample = {
  input: string;
  output: string;
  explanation: string | null;
};

export type ProblemDetail = ProblemSummary & {
  statement: string;
  constraints: string | null;
  examples: ProblemExample[];
  hints: string[];
  follow_up: string | null;
  visualization_meta: Record<string, unknown>;
  license: string;
  attribution_text: string | null;
  function_name: string | null;
  starter_code: string | null;
};

export async function fetchProblems(): Promise<ProblemSummary[]> {
  const res = await fetch(`${PROBLEM_API}/problems`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load problems");
  return res.json();
}

export async function fetchProblem(id: string): Promise<ProblemDetail> {
  const res = await fetch(`${PROBLEM_API}/problems/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load problem");
  return res.json();
}

export type AuthUser = { id: string; name: string; email: string; streak: number };

export type Recommendation = { id: string; title: string; difficulty: string; pattern: string };
export type WeakPattern = { pattern: string; mastery_score: number; attempts: number };

export async function fetchRecommendations(userId: string): Promise<{ mode: string; problems: Recommendation[] }> {
  const res = await fetch(`${REC_API}/recommendations/${userId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load recommendations");
  return res.json();
}

export async function fetchWeakPatterns(userId: string): Promise<{ patterns: WeakPattern[] }> {
  const res = await fetch(`${REC_API}/weak-patterns/${userId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load weak patterns");
  return res.json();
}

export type NotepadData = {
  problem_id: string | null;
  content_type: "sketch" | "text";
  content: Record<string, unknown>;
};

export async function fetchNotepads(token: string, problemId?: string): Promise<NotepadData[]> {
  const qs = problemId ? `?problem_id=${problemId}` : "";
  const res = await fetch(`${USER_API}/notepads${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load notepads");
  return res.json();
}

export async function saveNotepad(token: string, pad: NotepadData): Promise<void> {
  const res = await fetch(`${USER_API}/notepads`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(pad),
  });
  if (!res.ok) throw new Error("Failed to save notepad");
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${USER_API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Login failed");
  const { access_token } = await res.json();
  return { token: access_token };
}

export async function register(name: string, email: string, password: string): Promise<void> {
  const res = await fetch(`${USER_API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Registration failed");
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${USER_API}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load user");
  return res.json();
}

export type TestCaseResult = {
  passed: boolean;
  runtime_ms: number;
  stdout: string | null;
  expected: string | null;
  error: string | null;
};

export type SubmissionResult = {
  id: string;
  status: string;
  runtime_ms: number | null;
  memory_kb: number | null;
  test_results: TestCaseResult[];
};

export async function submitSolution(
  userId: string,
  problemId: string,
  code: string
): Promise<SubmissionResult> {
  const res = await fetch(`${JUDGE_API}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, problem_id: problemId, language: "python", code }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Submission failed");
  return res.json();
}

export type RunResult = {
  all_passed: boolean;
  runtime_ms: number;
  test_results: TestCaseResult[];
};

// Run: checks against sample tests only (matches the Examples shown on the
// problem page), nothing recorded — the fast-feedback tier LeetCode's own
// Run button provides, distinct from the judged/recorded Submit.
export async function runSolution(problemId: string, code: string): Promise<RunResult> {
  const res = await fetch(`${JUDGE_API}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem_id: problemId, language: "python", code }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? "Run failed");
  return res.json();
}

export async function startTrace(sessionId: string, code: string, background = false): Promise<void> {
  const res = await fetch(`${TRACE_API}/trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, code, background }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null))?.detail;
    throw new Error(detail ?? "Failed to start trace");
  }
}

export type TrieNode = { [edge: string]: TrieNode | null };

export type TraceValue = {
  type: string;
  repr: string | null;
  renderer:
    | "scalar" | "array" | "queue" | "linked_list" | "binary_tree" | "dp_table"
    | "graph" | "weighted_graph" | "trie" | "hashmap" | "object";
  values?: (string | null)[];
  heap_property?: boolean;
  nodes?: (string | null)[];
  node_ids?: (string | null)[];
  obj_id?: string | null;
  tree?: TreeNode | null;
  trie?: TrieNode | null;
  rows?: (string | null)[][];
  adjacency?: Record<string, (string | null)[]>;
  weighted_adjacency?: Record<string, Record<string, string | null>>;
  entries?: Record<string, string | null>;
  fields?: Record<string, TraceValue>;
};

export type TreeNode = {
  value: string | null;
  left: TreeNode | null;
  right: TreeNode | null;
};

export type TraceFrame = {
  step: number;
  line: number | null;
  call_stack: { name: string; line: number }[];
  variables: Record<string, TraceValue>;
  stack_locals: { name: string; line: number; locals: Record<string, TraceValue> }[];
  recursion: { active: boolean; depth: number };
};

export type TraceStreamEvent =
  | ({ kind: "frame" } & TraceFrame)
  | { kind: "limit_exceeded"; steps: number }
  | { kind: "trace_complete" };

// The Redis subscribe must actually complete server-side before /trace is
// POSTed — pub/sub doesn't buffer, so frames published before a subscriber
// exists are lost. ws.onopen fires on handshake, which is too early; wait for
// the server's explicit "subscribed" ack instead, then call startTrace.
export function connectTraceStream(
  sessionId: string,
  onEvent: (event: TraceStreamEvent) => void,
  onReady: () => void
): () => void {
  const ws = new WebSocket(`${VIZ_WS}/ws/visualize/${sessionId}`);
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === "subscribed") onReady();
    else if (data.type === "trace_complete") onEvent({ kind: "trace_complete" });
    else if (data.type === "limit_exceeded") onEvent({ kind: "limit_exceeded", steps: data.steps });
    else onEvent({ kind: "frame", ...data });
  };
  return () => ws.close();
}
