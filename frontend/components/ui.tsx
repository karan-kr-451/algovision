const difficultyStyles: Record<string, string> = {
  easy: "text-ok bg-ok/10",
  medium: "text-warn bg-warn/10",
  hard: "text-err bg-err/10",
};

export function DifficultyPill({ difficulty }: { difficulty: string }) {
  return (
    <span
      className={`text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full ${
        difficultyStyles[difficulty] ?? "text-ink-subtle bg-surface-2"
      }`}
    >
      {difficulty}
    </span>
  );
}

export function PatternChip({ pattern }: { pattern: string }) {
  return (
    <span className="text-[11px] font-mono text-ink-subtle bg-surface-2 border border-hairline px-1.5 py-0.5 rounded">
      {pattern}
    </span>
  );
}

export function BrandMark() {
  return (
    <span className="font-semibold tracking-tight text-ink">
      Algo<span className="text-accent">Vision</span>
    </span>
  );
}
