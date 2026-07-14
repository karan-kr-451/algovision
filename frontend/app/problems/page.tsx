import Link from "next/link";
import { fetchProblems } from "@/lib/api";

const difficultyColor: Record<string, string> = {
  easy: "text-green-400",
  medium: "text-yellow-400",
  hard: "text-red-400",
};

export default async function ProblemsPage() {
  let problems: Awaited<ReturnType<typeof fetchProblems>> = [];
  let error: string | null = null;
  try {
    problems = await fetchProblems();
  } catch {
    error = "Problem service unavailable — start it and refresh.";
  }

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Problems</h1>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex flex-col gap-2">
        {problems.map((p) => (
          <Link
            key={p.id}
            href={`/problems/${p.id}`}
            className="rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 flex justify-between items-center"
          >
            <div>
              <div>{p.title}</div>
              <div className="text-xs text-zinc-500 mt-1">{p.pattern}</div>
            </div>
            <span className={`text-xs uppercase ${difficultyColor[p.difficulty]}`}>
              {p.difficulty}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
