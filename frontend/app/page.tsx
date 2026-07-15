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
import { DifficultyPill, PatternChip } from "@/components/ui";

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
    <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 flex flex-col gap-10">
      <section>
        <h1 className="text-3xl font-semibold">
          {user ? `Welcome back, ${user.name}` : "Learn algorithms by watching your own code run"}
        </h1>
        <p className="text-ink-muted mt-2">Visualize along with code — not after it.</p>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-[10px] border border-hairline bg-surface-1 p-5">
          <div className="text-ink-subtle text-xs uppercase tracking-wide">Streak</div>
          <div className="text-3xl font-semibold mt-2">
            {user ? (
              <>
                <span className="text-warn">⚡</span> {user.streak}{" "}
                <span className="text-base text-ink-muted font-normal">
                  day{user.streak === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span className="text-ink-subtle">—</span>
            )}
          </div>
        </div>
        <div className="rounded-[10px] border border-hairline bg-surface-1 p-5">
          <div className="text-ink-subtle text-xs uppercase tracking-wide">Weak patterns</div>
          <div className="mt-2 flex flex-col gap-2">
            {weak.length === 0 && <span className="text-3xl font-semibold text-ink-subtle">—</span>}
            {weak.map((w) => (
              <div key={w.pattern}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono text-ink-muted">{w.pattern}</span>
                  <span className="text-ink-subtle">{Math.round(w.mastery_score * 100)}%</span>
                </div>
                <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-strong"
                    style={{ width: `${Math.max(w.mastery_score * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">
          {user ? "Recommended next" : "Start here"}
        </h2>
        {error && <p className="text-err text-sm">{error}</p>}
        <div className="flex flex-col gap-2">
          {cards.map((p) => (
            <Link
              key={p.id}
              href={`/problems/${p.id}`}
              className="rounded-[10px] border border-hairline bg-surface-1 p-4 hover:border-hairline-strong transition-colors flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <span>{p.title}</span>
                <PatternChip pattern={p.pattern} />
              </div>
              <DifficultyPill difficulty={p.difficulty} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
