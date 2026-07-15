"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TraceValue } from "@/lib/api";

export type Pointer = { name: string; index: number };

export function ArrayView({
  values,
  changed,
  pointers,
}: {
  values: (string | null)[];
  changed?: Set<number>;
  pointers?: Pointer[];
}) {
  return (
    <div className="flex gap-1 flex-wrap items-start">
      <AnimatePresence initial={false}>
        {values.map((v, i) => {
          const cellPointers = (pointers ?? []).filter((p) => p.index === i);
          return (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: 1,
                scale: 1,
                backgroundColor: changed?.has(i) ? "rgba(59,130,246,0.35)" : "rgba(0,0,0,0)",
              }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center"
            >
              <div className="w-10 h-10 flex items-center justify-center border border-hairline-strong rounded text-sm">
                {v}
              </div>
              <span className="text-[10px] text-ink-subtle mt-0.5">{i}</span>
              <div className="flex flex-col items-center min-h-[16px]">
                {cellPointers.map((p) => (
                  <motion.span
                    key={p.name}
                    layoutId={`ptr-${p.name}`}
                    className="text-[10px] text-live leading-tight"
                  >
                    ▲ {p.name}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {values.length === 0 && <span className="text-ink-subtle text-sm">empty</span>}
    </div>
  );
}

export function LinkedListView({
  nodes,
  highlightIndex,
}: {
  nodes: (string | null)[];
  highlightIndex?: number;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <AnimatePresence initial={false}>
        {nodes.map((v, i) => (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1"
          >
            <div
              className={`w-10 h-10 flex items-center justify-center border rounded text-sm ${
                i === highlightIndex ? "border-live bg-live/20" : "border-hairline-strong"
              }`}
            >
              {v}
            </div>
            {i < nodes.length - 1 && <span className="text-ink-subtle">&rarr;</span>}
          </motion.div>
        ))}
      </AnimatePresence>
      {nodes.length === 0 && <span className="text-ink-subtle text-sm">empty</span>}
    </div>
  );
}

export function HashmapView({
  entries,
  changed,
}: {
  entries: Record<string, string | null>;
  changed?: Set<string>;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      <AnimatePresence initial={false}>
        {Object.entries(entries).map(([k, v]) => (
          <motion.div
            key={k}
            layout
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: 1,
              scale: 1,
              backgroundColor: changed?.has(k) ? "rgba(59,130,246,0.35)" : "rgba(0,0,0,0)",
            }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="flex flex-col items-center border border-hairline-strong rounded overflow-hidden"
          >
            <div className="px-2 py-1 text-xs bg-surface-2 w-full text-center">{k}</div>
            <div className="px-2 py-1 text-sm">{v}</div>
          </motion.div>
        ))}
      </AnimatePresence>
      {Object.keys(entries).length === 0 && <span className="text-ink-subtle text-sm">empty</span>}
    </div>
  );
}

export function DpTableView({
  rows,
  changed,
}: {
  rows: (string | null)[][];
  changed?: Set<string>; // "i,j" keys
}) {
  return (
    <table className="border-collapse">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <motion.td
                key={j}
                animate={{
                  backgroundColor: changed?.has(`${i},${j}`)
                    ? "rgba(59,130,246,0.45)"
                    : "rgba(0,0,0,0)",
                }}
                transition={{ duration: 0.3 }}
                className="w-9 h-9 border border-hairline-strong text-center text-sm"
              >
                {cell}
              </motion.td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScalarView({ value, changed }: { value: TraceValue; changed?: boolean }) {
  return (
    <motion.span
      animate={{ color: changed ? "#60a5fa" : "#e4e4e7" }}
      transition={{ duration: 0.3 }}
      className="text-sm font-mono"
    >
      {value.repr}
    </motion.span>
  );
}
