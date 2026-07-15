"use client";

import MonacoEditor from "@monaco-editor/react";
import { useState } from "react";
import { runSolution, submitSolution, type RunResult, type SubmissionResult } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const verdictColor: Record<string, string> = {
  accepted: "text-ok",
  wrong_answer: "text-err",
  tle: "text-warn",
  mle: "text-warn",
  runtime_error: "text-err",
};

type Outcome =
  | { kind: "run"; result: RunResult }
  | { kind: "submit"; result: SubmissionResult };

export default function Editor({
  problemId,
  code,
  onChange,
}: {
  problemId: string;
  code: string;
  onChange: (code: string) => void;
}) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  async function handleRun() {
    setBusy("run");
    setError(null);
    setOutcome(null);
    try {
      const result = await runSolution(problemId, code);
      setOutcome({ kind: "run", result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    if (!user) {
      setError("Log in to submit a solution for this problem.");
      return;
    }
    setBusy("submit");
    setError(null);
    setOutcome(null);
    try {
      const result = await submitSolution(user.id, problemId, code);
      setOutcome({ kind: "submit", result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-hairline">
        <span className="text-sm text-ink-muted">Python</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={busy !== null}
            className="text-sm bg-surface-2 border border-hairline text-ink px-3 py-1 rounded-md hover:border-hairline-strong transition-colors disabled:opacity-50"
            title="Run against sample tests"
          >
            {busy === "run" ? "Running…" : "Run"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy !== null}
            className="text-sm bg-accent-strong text-white px-3 py-1 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            title="Judge against the full test suite"
          >
            {busy === "submit" ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(value) => onChange(value ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 14 }}
        />
      </div>
      {(outcome || error) && (
        <div className="border-t border-hairline px-4 py-3 text-sm max-h-48 overflow-y-auto">
          {error && <p className="text-err">{error}</p>}
          {outcome?.kind === "run" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={outcome.result.all_passed ? "text-ok font-medium" : "text-warn font-medium"}>
                  {outcome.result.all_passed
                    ? "Sample tests passed"
                    : `${outcome.result.test_results.filter((t) => t.passed).length}/${outcome.result.test_results.length} sample tests passed`}
                </span>
                <span className="text-ink-subtle">{outcome.result.runtime_ms}ms</span>
              </div>
              {outcome.result.test_results.map((tc, i) => (
                <div key={i} className="text-ink-muted font-mono text-xs">
                  test {i + 1}: {tc.passed ? "✓ pass" : "✗ fail"}
                  {tc.error && ` — ${tc.error}`}
                  {!tc.passed && !tc.error && ` — got "${tc.stdout}", expected "${tc.expected}"`}
                </div>
              ))}
            </div>
          )}
          {outcome?.kind === "submit" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`font-medium uppercase ${verdictColor[outcome.result.status]}`}>
                  {outcome.result.status.replace("_", " ")}
                </span>
                {outcome.result.runtime_ms !== null && (
                  <span className="text-ink-subtle">{outcome.result.runtime_ms}ms</span>
                )}
              </div>
              {outcome.result.test_results.map((tc, i) => (
                <div key={i} className="text-ink-muted font-mono text-xs">
                  test {i + 1}: {tc.passed ? "✓ pass" : "✗ fail"}
                  {tc.error && ` — ${tc.error}`}
                  {!tc.passed && !tc.error && ` — got "${tc.stdout}", expected "${tc.expected}"`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
