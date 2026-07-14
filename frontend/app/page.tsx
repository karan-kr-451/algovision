"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchProblems,
  fetchRecommendations,
  fetchWeakPatterns,
  type ProblemSummary,
  type Recommendation,
  type WeakPattern,
} from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [recommended, setRecommended] = useState<Recommendation[]>([]);
  const [weak, setWeak] = useState<WeakPattern[]>([]);
  const [fallback, setFallback] = useState<ProblemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user) {
      fetchRecommendations(user.id)
        .then((r) => setRecommended(r.problems))
        .catch(() => setError("Recommendation service unavailable."));
      fetchWeakPatterns(user.id)
        .then((r) => setWeak(r.patterns))
        .catch(() => {});
    } else {
      fetchProblems()
        .then((ps) => setFallback(ps.slice(0, 3)))
        .catch(() => setError("Problem service unavailable — start it and refresh."));
    }
  }, [user, loading]);

  const cards = user
    ? recommended
    : fallback.map((p) => ({ id: p.id, title: p.title, difficulty: p.difficulty, pattern: p.pattern }));

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold">
          {user ? `Welcome back, ${user.name}` : "Welcome"}
        </h1>
        <p className="text-zinc-400 mt-1">Visualize along with code — not after it.</p>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-800 p-4">
          <div className="text-zinc-400 text-sm">Streak</div>
          <div className="text-3xl font-semibold mt-1">
            {user ? `${user.streak} day${user.streak === 1 ? "" : "s"}` : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 p-4">
          <div className="text-zinc-400 text-sm">Weak patterns</div>
          <div className="mt-1">
            {weak.length === 0 && <span className="text-3xl font-semibold">—</span>}
            {weak.map((w) => (
              <div key={w.pattern} className="text-sm flex justify-between">
                <span>{w.pattern}</span>
                <span className="text-zinc-500">{Math.round(w.mastery_score * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">
          {user ? "Recommended next" : "Popular problems"}
        </h2>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex flex-col gap-2">
          {cards.map((p) => (
            <Link
              key={p.id}
              href={`/problems/${p.id}`}
              className="rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 flex justify-between items-center"
            >
              <div>
                <div>{p.title}</div>
                <div className="text-xs text-zinc-500 mt-1">{p.pattern}</div>
              </div>
              <span className="text-xs uppercase text-zinc-400">{p.difficulty}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
