import Link from "next/link";
import { fetchProblems } from "@/lib/api";
import { DifficultyPill, PatternChip } from "@/components/ui";

export default async function ProblemsPage() {
  let problems: Awaited<ReturnType<typeof fetchProblems>> = [];
  let error: string | null = null;
  try {
    problems = await fetchProblems();
  } catch {
    error = "Problem service unavailable — start it and refresh.";
  }

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Problems</h1>
        <p className="text-ink-subtle text-sm mt-1">{problems.length} problems</p>
      </div>
      {error && <p className="text-err text-sm">{error}</p>}
      <div className="flex flex-col rounded-[10px] border border-hairline overflow-hidden divide-y divide-hairline">
        {problems.map((p) => (
          <Link
            key={p.id}
            href={`/problems/${p.id}`}
            className="bg-surface-1 px-4 py-3 hover:bg-surface-2 transition-colors flex justify-between items-center"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="truncate">{p.title}</span>
              <PatternChip pattern={p.pattern} />
            </div>
            <DifficultyPill difficulty={p.difficulty} />
          </Link>
        ))}
      </div>
    </div>
  );
}
