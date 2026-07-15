"use client";

import { useState } from "react";
import type { ProblemExample } from "@/lib/api";

// Renders code-span-style identifiers (nums, target, s, ...) the way LeetCode
// does inline in prose — anything backtick-quoted in the statement text.
function InlineCode({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="font-mono text-[13px] bg-surface-2 px-1 py-0.5 rounded">
            {part}
          </code>
        ) : (
          part
        )
      )}
    </>
  );
}

function ExampleBlock({ example, index }: { example: ProblemExample; index: number }) {
  return (
    <div className="mt-4">
      <p className="font-semibold text-sm text-ink">Example {index + 1}:</p>
      <div className="mt-2 bg-surface-1 border border-hairline rounded-[10px] p-3 font-mono text-[13px] leading-relaxed">
        <div>
          <span className="text-ink-muted">Input: </span>
          <span className="text-ink">{example.input}</span>
        </div>
        <div>
          <span className="text-ink-muted">Output: </span>
          <span className="text-ink">{example.output}</span>
        </div>
        {example.explanation && (
          <div className="mt-1">
            <span className="text-ink-muted">Explanation: </span>
            <span className="text-ink-muted">{example.explanation}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ConstraintsList({ constraints }: { constraints: string }) {
  const lines = constraints
    .split("\n")
    .map((l) => l.replace(/^-\s*/, "").trim())
    .filter(Boolean);
  return (
    <ul className="mt-2 list-disc list-inside space-y-1">
      {lines.map((line, i) => (
        <li key={i} className="text-ink-subtle text-sm font-mono">
          {line}
        </li>
      ))}
    </ul>
  );
}

function Hints({ hints }: { hints: string[] }) {
  const [revealed, setRevealed] = useState(0);
  if (hints.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-ink">Hints</h2>
      <div className="mt-2 flex flex-col gap-2">
        {hints.slice(0, revealed).map((hint, i) => (
          <p key={i} className="text-sm text-ink-muted bg-surface-1 border border-hairline rounded-[10px] p-3">
            <span className="text-ink-subtle mr-1">Hint {i + 1}:</span>
            {hint}
          </p>
        ))}
      </div>
      {revealed < hints.length && (
        <button
          onClick={() => setRevealed(revealed + 1)}
          className="mt-2 text-xs text-accent hover:text-accent-strong border border-hairline rounded-md px-2 py-1 transition-colors"
        >
          Show hint {revealed + 1} of {hints.length}
        </button>
      )}
    </div>
  );
}

export default function ProblemStatement({
  statement,
  examples,
  constraints,
  hints,
  followUp,
}: {
  statement: string;
  examples: ProblemExample[];
  constraints: string | null;
  hints: string[];
  followUp: string | null;
}) {
  return (
    <>
      <p className="mt-5 whitespace-pre-wrap text-ink-muted leading-relaxed">
        <InlineCode text={statement} />
      </p>

      {examples.map((ex, i) => (
        <ExampleBlock key={i} example={ex} index={i} />
      ))}

      {constraints && (
        <>
          <h2 className="mt-8 text-sm font-medium text-ink">Constraints</h2>
          <ConstraintsList constraints={constraints} />
        </>
      )}

      {followUp && (
        <p className="mt-6 text-sm text-ink-muted italic border-l-2 border-accent/50 pl-3">
          Follow-up: <InlineCode text={followUp} />
        </p>
      )}

      <Hints hints={hints} />
    </>
  );
}
