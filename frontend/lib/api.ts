export const USER_API = process.env.NEXT_PUBLIC_USER_API ?? "http://localhost:8001";
export const PROBLEM_API = process.env.NEXT_PUBLIC_PROBLEM_API ?? "http://localhost:8002";

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
