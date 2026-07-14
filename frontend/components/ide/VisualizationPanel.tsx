"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectTraceStream,
  startTrace,
  type TraceFrame,
  type TraceValue,
} from "@/lib/api";
import { ArrayView, DpTableView, HashmapView, LinkedListView, ScalarView, type Pointer } from "./renderers";
import { BinaryTreeView, GraphView } from "./layouts";

const SPEEDS = [0.5, 1, 2, 5];
const BASE_STEP_MS = 800;
const TYPING_DEBOUNCE_MS = 600;

// ---------- frame diffing (items 1 + 6): everything derives from real
// consecutive trace frames — no scripted animation path exists.

function changedIndices(prev?: TraceValue, cur?: TraceValue): Set<number> {
  const out = new Set<number>();
  const a = prev?.values ?? [];
  const b = cur?.values ?? [];
  for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) out.add(i);
  return out;
}

function changedCells(prev?: TraceValue, cur?: TraceValue): Set<string> {
  const out = new Set<string>();
  const a = prev?.rows ?? [];
  const b = cur?.rows ?? [];
  for (let i = 0; i < b.length; i++)
    for (let j = 0; j < (b[i]?.length ?? 0); j++)
      if (a[i]?.[j] !== b[i]?.[j]) out.add(`${i},${j}`);
  return out;
}

function changedKeys(prev?: TraceValue, cur?: TraceValue): Set<string> {
  const out = new Set<string>();
  const a = prev?.entries ?? {};
  const b = cur?.entries ?? {};
  for (const k of Object.keys(b)) if (a[k] !== b[k]) out.add(k);
  return out;
}

// ---------- pointer detection (item 2): int scalars whose value indexes into
// a co-visible array render as pointer chips under that array's cells.

function detectPointers(variables: Record<string, TraceValue>, arrayName: string): Pointer[] {
  const arr = variables[arrayName];
  const len = arr?.values?.length ?? 0;
  if (!len) return [];
  const pointers: Pointer[] = [];
  for (const [name, v] of Object.entries(variables)) {
    if (name === arrayName || v.renderer !== "scalar" || v.type !== "int") continue;
    const idx = Number(v.repr);
    if (Number.isInteger(idx) && idx >= 0 && idx < len) pointers.push({ name, index: idx });
  }
  return pointers;
}

// ---------- aliasing (item 5 MVP): a variable pointing at a node inside
// another variable's linked list gets a badge instead of a duplicate chain.

function findAlias(
  name: string,
  value: TraceValue,
  variables: Record<string, TraceValue>
): { listName: string; nodeIndex: number } | null {
  if (!value.obj_id) return null;
  for (const [otherName, other] of Object.entries(variables)) {
    if (otherName === name || other.renderer !== "linked_list" || !other.node_ids) continue;
    const idx = other.node_ids.indexOf(value.obj_id);
    // Skip self-comparison when both vars are the same full list (index 0 + same length)
    if (idx > 0 || (idx === 0 && (value.nodes?.length ?? 0) < (other.nodes?.length ?? 0))) {
      return { listName: otherName, nodeIndex: idx };
    }
  }
  return null;
}

function ValueView({
  name,
  value,
  prev,
  variables,
}: {
  name: string;
  value: TraceValue;
  prev?: TraceValue;
  variables: Record<string, TraceValue>;
}) {
  switch (value.renderer) {
    case "array":
    case "queue":
      return (
        <ArrayView
          values={value.values ?? []}
          changed={changedIndices(prev, value)}
          pointers={detectPointers(variables, name)}
        />
      );
    case "hashmap":
      return <HashmapView entries={value.entries ?? {}} changed={changedKeys(prev, value)} />;
    case "linked_list": {
      const alias = findAlias(name, value, variables);
      if (alias) {
        return (
          <div className="text-sm text-blue-400">
            → node {alias.nodeIndex} of <span className="font-mono">{alias.listName}</span>
          </div>
        );
      }
      return <LinkedListView nodes={value.nodes ?? []} />;
    }
    case "binary_tree":
      return <BinaryTreeView tree={value.tree ?? null} />;
    case "dp_table":
      return <DpTableView rows={value.rows ?? []} changed={changedCells(prev, value)} />;
    case "graph":
      return <GraphView adjacency={value.adjacency ?? {}} />;
    default:
      return <ScalarView value={value} changed={prev !== undefined && prev.repr !== value.repr} />;
  }
}

export default function VisualizationPanel({ code }: { code: string }) {
  const [frames, setFrames] = useState<TraceFrame[]>([]);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const disconnectRef = useRef<(() => void) | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  useEffect(() => () => disconnectRef.current?.(), []);

  const runTrace = useCallback(
    (background: boolean) => {
      disconnectRef.current?.();
      setStatus("running");
      if (!background) {
        setFrames([]);
        setCursor(0);
        setLiveNote(null);
      }

      // Background runs buffer into `pending` and only replace the displayed
      // trace once the new run completes with at least one frame — the
      // visualization never blanks out mid-edit (spec §2.1 rule 3/4).
      const pending: TraceFrame[] = [];
      const sessionId = crypto.randomUUID();

      disconnectRef.current = connectTraceStream(
        sessionId,
        (event) => {
          if (event.kind === "frame") {
            if (background) {
              pending.push(event);
            } else {
              setFrames((prevFrames) => {
                const next = [...prevFrames, event];
                setCursor(next.length - 1);
                return next;
              });
            }
          } else {
            // trace_complete or limit_exceeded — both mean the run is over
            if (background && pending.length > 0) {
              setFrames(pending);
              setCursor(pending.length - 1);
              setLiveNote(null);
            }
            setStatus("done");
          }
        },
        () => {
          startTrace(sessionId, code, background).catch((e) => {
            if (background) {
              // 422 = not eligible (syntax error / I/O call): keep last good trace
              setLiveNote(e instanceof Error ? e.message : "waiting for valid code");
              setStatus("done");
            } else {
              setLiveNote(e instanceof Error ? e.message : "trace failed");
              setStatus("error");
            }
            disconnectRef.current?.();
          });
        }
      );
    },
    [code]
  );

  // ---------- live-while-typing (item 7): debounced background re-run
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runTrace(true), TYPING_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code, runTrace]);

  // ---------- auto-play (item 3)
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const id = setInterval(() => {
      setCursor((c) => {
        if (c >= frames.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, BASE_STEP_MS / speed);
    return () => clearInterval(id);
  }, [playing, speed, frames.length]);

  const frame = frames[cursor];
  const prevFrame = cursor > 0 ? frames[cursor - 1] : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-sm text-zinc-400">
          Visualization
          {liveNote && <span className="ml-2 text-xs text-yellow-500/80">{liveNote}</span>}
        </span>
        <button
          onClick={() => runTrace(false)}
          disabled={status === "running" && frames.length === 0}
          className="text-sm bg-zinc-100 text-zinc-900 px-3 py-1 rounded hover:bg-white disabled:opacity-50"
        >
          {status === "running" ? "Tracing…" : "Visualize"}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!frame && status === "idle" && (
          <p className="text-zinc-500 text-sm">
            Start typing, or click Visualize — the panel traces your real execution.
          </p>
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
                <ValueView
                  name={name}
                  value={value}
                  prev={prevFrame?.variables[name]}
                  variables={frame.variables}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {frames.length > 0 && (
        <div className="border-t border-zinc-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (!playing && cursor >= frames.length - 1) setCursor(0);
              setPlaying(!playing);
            }}
            className="text-sm text-zinc-300 hover:text-white w-6"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-transparent text-xs text-zinc-400 border border-zinc-700 rounded px-1 py-0.5"
            aria-label="Playback speed"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s} className="bg-zinc-900">
                {s}x
              </option>
            ))}
          </select>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={cursor}
            onChange={(e) => {
              setPlaying(false);
              setCursor(Number(e.target.value));
            }}
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
