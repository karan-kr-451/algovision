"use client";

import MonacoEditor from "@monaco-editor/react";
import { useState } from "react";
import { submitSolution, type SubmissionResult } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const verdictColor: Record<string, string> = {
  accepted: "text-ok",
  wrong_answer: "text-err",
  tle: "text-warn",
  mle: "text-warn",
  runtime_error: "text-err",
};

export default function Editor({
  problemId,
  code,
  onChange,
}: {
  problemId: string;
  code: string;
  onChange: (code: string) => void;
}) {
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  async function handleRun() {
    if (!user) {
      setError("Log in to run code against this problem.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await submitSolution(user.id, problemId, code);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-hairline">
        <span className="text-sm text-ink-muted">Python</span>
        <button
          onClick={handleRun}
          disabled={running}
          className="text-sm bg-surface-2 border border-hairline text-ink px-3 py-1 rounded-md hover:border-hairline-strong transition-colors disabled:opacity-50"
          title="Ctrl+Enter"
        >
          {running ? "Running…" : "Run"}
        </button>
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
      {(result || error) && (
        <div className="border-t border-hairline px-4 py-3 text-sm max-h-48 overflow-y-auto">
          {error && <p className="text-err">{error}</p>}
          {result && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`font-medium uppercase ${verdictColor[result.status]}`}>
                  {result.status.replace("_", " ")}
                </span>
                {result.runtime_ms !== null && (
                  <span className="text-ink-subtle">{result.runtime_ms}ms</span>
                )}
              </div>
              {result.test_results.map((tc, i) => (
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
