export const USER_API = process.env.NEXT_PUBLIC_USER_API ?? "http://localhost:8001";
export const PROBLEM_API = process.env.NEXT_PUBLIC_PROBLEM_API ?? "http://localhost:8002";
export const JUDGE_API = process.env.NEXT_PUBLIC_JUDGE_API ?? "http://localhost:8003";

export type ProblemSummary = {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  pattern: string;
  tags: string[];
  visualization_tier: "core" | "extended" | "conceptual";
};

export type ProblemDetail = ProblemSummary & {
  statement: string;
  constraints: string | null;
  examples: unknown[];
  visualization_meta: Record<string, unknown>;
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

export type AuthUser = { id: string; name: string; email: string };

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
