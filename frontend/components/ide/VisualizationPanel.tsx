"use client";

import { useEffect, useRef, useState } from "react";
import { connectTraceStream, startTrace, type TraceFrame, type TraceValue } from "@/lib/api";

function ArrayView({ values }: { values: (string | null)[] }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className="w-10 h-10 flex items-center justify-center border border-zinc-700 rounded text-sm">
            {v}
          </div>
          <span className="text-[10px] text-zinc-500 mt-0.5">{i}</span>
        </div>
      ))}
    </div>
  );
}

function LinkedListView({ nodes }: { nodes: (string | null)[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {nodes.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="w-10 h-10 flex items-center justify-center border border-zinc-700 rounded text-sm">
            {v}
          </div>
          {i < nodes.length - 1 && <span className="text-zinc-500">&rarr;</span>}
        </div>
      ))}
      {nodes.length === 0 && <span className="text-zinc-500 text-sm">empty</span>}
    </div>
  );
}

function TreeView({ tree }: { tree: TraceValue["tree"] }) {
  if (!tree) return <span className="text-zinc-500 text-sm">null</span>;
  return (
    <div className="flex flex-col items-center">
      <div className="w-9 h-9 flex items-center justify-center border border-zinc-700 rounded-full text-sm">
        {tree.value}
      </div>
      {(tree.left || tree.right) && (
        <div className="flex gap-6 mt-2 relative">
          <div className="flex flex-col items-center">
            {tree.left ? <TreeView tree={tree.left} /> : <div className="w-9 h-9" />}
          </div>
          <div className="flex flex-col items-center">
            {tree.right ? <TreeView tree={tree.right} /> : <div className="w-9 h-9" />}
          </div>
        </div>
      )}
    </div>
  );
}

function DpTableView({ rows }: { rows: (string | null)[][] }) {
  return (
    <table className="border-collapse">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="w-9 h-9 border border-zinc-700 text-center text-sm">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ValueView({ value }: { value: TraceValue }) {
  switch (value.renderer) {
    case "array":
    case "queue":
      return <ArrayView values={value.values ?? []} />;
    case "linked_list":
      return <LinkedListView nodes={value.nodes ?? []} />;
    case "binary_tree":
      return <TreeView tree={value.tree ?? null} />;
    case "dp_table":
      return <DpTableView rows={value.rows ?? []} />;
    case "graph":
      return (
        <div className="text-sm font-mono">
          {Object.entries(value.adjacency ?? {}).map(([k, v]) => (
            <div key={k}>
              {k} &rarr; [{v.join(", ")}]
            </div>
          ))}
        </div>
      );
    default:
      return <span className="text-sm font-mono">{value.repr}</span>;
  }
}

export default function VisualizationPanel({ code }: { code: string }) {
  const [frames, setFrames] = useState<TraceFrame[]>([]);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => () => disconnectRef.current?.(), []);

  function handleVisualize() {
    disconnectRef.current?.();
    setFrames([]);
    setCursor(0);
    setStatus("running");
    setError(null);

    const sessionId = crypto.randomUUID();
    disconnectRef.current = connectTraceStream(
      sessionId,
      (event) => {
        if (event.kind === "frame") {
          setFrames((prev) => {
            const next = [...prev, event];
            setCursor(next.length - 1);
            return next;
          });
        } else if (event.kind === "trace_complete") {
          setStatus("done");
        } else if (event.kind === "limit_exceeded") {
          setStatus("done");
        }
      },
      () => {
        startTrace(sessionId, code).catch((e) => {
          setError(e instanceof Error ? e.message : "Failed to start trace");
          setStatus("error");
        });
      }
    );
  }

  const frame = frames[cursor];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-sm text-zinc-400">Visualization</span>
        <button
          onClick={handleVisualize}
          disabled={status === "running" && frames.length === 0}
          className="text-sm bg-zinc-100 text-zinc-900 px-3 py-1 rounded hover:bg-white disabled:opacity-50"
        >
          {status === "running" ? "Tracing…" : "Visualize"}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!error && !frame && status === "idle" && (
          <p className="text-zinc-500 text-sm">Click Visualize to trace this code's execution.</p>
        )}
        {frame && (
          <div className="flex flex-col gap-4">
            <div className="text-xs text-zinc-500">
              step {frame.step} · line {frame.line}
              {frame.recursion.active && ` · recursion depth ${frame.recursion.depth}`}
            </div>
            {Object.entries(frame.variables).map(([name, value]) => (
              <div key={name}>
                <div className="text-xs text-zinc-400 mb-1 font-mono">{name}</div>
                <ValueView value={value} />
              </div>
            ))}
          </div>
        )}
      </div>

      {frames.length > 0 && (
        <div className="border-t border-zinc-800 px-4 py-3 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={cursor}
            onChange={(e) => setCursor(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs text-zinc-500 w-16 text-right">
            {cursor + 1}/{frames.length}
          </span>
        </div>
      )}
    </div>
  );
}
