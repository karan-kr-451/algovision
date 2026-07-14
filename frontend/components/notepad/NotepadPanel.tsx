"use client";

import { useEffect, useRef, useState } from "react";
import { fetchNotepads, saveNotepad } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const AUTOSAVE_MS = 800;

type Stroke = { points: [number, number][] };

function SketchCanvas({
  strokes,
  onChange,
}: {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const current = useRef<Stroke | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    for (const s of strokes) {
      ctx.beginPath();
      s.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
  }, [strokes]);

  function pos(e: React.PointerEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={280}
      className="border border-zinc-800 rounded bg-zinc-950 touch-none cursor-crosshair w-full"
      onPointerDown={(e) => {
        drawing.current = true;
        current.current = { points: [pos(e)] };
        canvasRef.current?.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drawing.current || !current.current) return;
        const p = pos(e);
        const prev = current.current.points[current.current.points.length - 1];
        current.current.points.push(p);
        // draw the live segment directly; the stroke is committed to state on release
        const ctx = canvasRef.current!.getContext("2d")!;
        ctx.strokeStyle = "#e4e4e7";
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      }}
      onPointerUp={() => {
        if (current.current && current.current.points.length > 1) {
          onChange([...strokes, current.current]);
        }
        drawing.current = false;
        current.current = null;
      }}
    />
  );
}

export default function NotepadPanel({ problemId }: { problemId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"text" | "sketch">("text");
  const [text, setText] = useState("");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [saved, setSaved] = useState(true);
  const loaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || loaded.current || !user) return;
    const token = localStorage.getItem("av_token");
    if (!token) return;
    fetchNotepads(token, problemId)
      .then((pads) => {
        for (const pad of pads) {
          if (pad.content_type === "text") setText((pad.content.markdown as string) ?? "");
          if (pad.content_type === "sketch") setStrokes((pad.content.strokes as Stroke[]) ?? []);
        }
        loaded.current = true;
      })
      .catch(() => {});
  }, [open, user, problemId]);

  function scheduleAutosave(contentType: "text" | "sketch", content: Record<string, unknown>) {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const token = localStorage.getItem("av_token");
      if (!token) return;
      saveNotepad(token, { problem_id: problemId, content_type: contentType, content })
        .then(() => setSaved(true))
        .catch(() => {});
    }, AUTOSAVE_MS);
  }

  if (!user) return null;

  return (
    <div className="border-t border-zinc-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 flex justify-between"
      >
        <span>Notepad</span>
        <span className="text-xs">
          {!saved && <span className="text-yellow-500 mr-2">saving…</span>}
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="flex gap-2 mb-2">
            {(["text", "sketch"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-xs px-2 py-1 rounded border ${
                  mode === m ? "border-blue-500 text-blue-400" : "border-zinc-700 text-zinc-400"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {mode === "text" ? (
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                scheduleAutosave("text", { markdown: e.target.value });
              }}
              placeholder="Notes on your approach, complexity, why it failed…"
              className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded p-2 text-sm resize-y"
            />
          ) : (
            <div>
              <SketchCanvas
                strokes={strokes}
                onChange={(s) => {
                  setStrokes(s);
                  scheduleAutosave("sketch", { strokes: s });
                }}
              />
              <button
                onClick={() => {
                  setStrokes([]);
                  scheduleAutosave("sketch", { strokes: [] });
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 mt-1"
              >
                clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
