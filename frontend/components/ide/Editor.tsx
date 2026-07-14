"use client";

import MonacoEditor from "@monaco-editor/react";
import { useState } from "react";
import { submitSolution, type SubmissionResult } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const DEFAULT_CODE = `# Read input from stdin, print the answer to stdout.\n`;

const verdictColor: Record<string, string> = {
  accepted: "text-green-400",
  wrong_answer: "text-red-400",
  tle: "text-yellow-400",
  mle: "text-yellow-400",
  runtime_error: "text-red-400",
};

export default function Editor({ problemId }: { problemId: string }) {
  const [code, setCode] = useState(DEFAULT_CODE);
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-sm text-zinc-400">Python</span>
        <button
          onClick={handleRun}
          disabled={running}
          className="text-sm bg-zinc-100 text-zinc-900 px-3 py-1 rounded hover:bg-white disabled:opacity-50"
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
          onChange={(value) => setCode(value ?? "")}
          options={{ minimap: { enabled: false }, fontSize: 14 }}
        />
      </div>
      {(result || error) && (
        <div className="border-t border-zinc-800 px-4 py-3 text-sm max-h-48 overflow-y-auto">
          {error && <p className="text-red-400">{error}</p>}
          {result && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`font-medium uppercase ${verdictColor[result.status]}`}>
                  {result.status.replace("_", " ")}
                </span>
                {result.runtime_ms !== null && (
                  <span className="text-zinc-500">{result.runtime_ms}ms</span>
                )}
              </div>
              {result.test_results.map((tc, i) => (
                <div key={i} className="text-zinc-400 font-mono text-xs">
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
