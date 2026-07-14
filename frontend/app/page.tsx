import Link from "next/link";
import { fetchProblems } from "@/lib/api";

export default async function Dashboard() {
  let recommended: Awaited<ReturnType<typeof fetchProblems>> = [];
  let error: string | null = null;
  try {
    recommended = (await fetchProblems()).slice(0, 3);
  } catch {
    error = "Problem service unavailable — start it and refresh.";
  }

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-zinc-400 mt-1">Visualize along with code — not after it.</p>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-800 p-4">
          <div className="text-zinc-400 text-sm">Streak</div>
          <div className="text-3xl font-semibold mt-1">0 days</div>
        </div>
        <div className="rounded-lg border border-zinc-800 p-4">
          <div className="text-zinc-400 text-sm">Weak patterns</div>
          <div className="text-3xl font-semibold mt-1">—</div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Recommended next</h2>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex flex-col gap-2">
          {recommended.map((p) => (
            <Link
              key={p.id}
              href={`/problems/${p.id}`}
              className="rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 flex justify-between items-center"
            >
              <span>{p.title}</span>
              <span className="text-xs uppercase text-zinc-400">{p.difficulty}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
