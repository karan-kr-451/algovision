"use client";

import { hierarchy, tree as d3tree } from "d3-hierarchy";
import dagre from "@dagrejs/dagre";
import { motion } from "framer-motion";
import type { TreeNode, TrieNode } from "@/lib/api";

const NODE_R = 16;

type PlacedNode = { id: string; label: string | null; x: number; y: number; phantom: boolean };
type PlacedEdge = { id: string; x1: number; y1: number; x2: number; y2: number };

// Phantom children keep left/right geometry: a node with only a right child
// must render that child on the right, which plain d3 tree layout won't do
// unless the missing left slot still occupies space.
type SlotNode = { label: string | null; path: string; phantom: boolean; children: SlotNode[] };

function toSlots(node: TreeNode | null, path: string): SlotNode {
  if (!node) return { label: null, path, phantom: true, children: [] };
  const children =
    node.left || node.right
      ? [toSlots(node.left, path + "L"), toSlots(node.right, path + "R")]
      : [];
  return { label: node.value, path, phantom: false, children };
}

export function BinaryTreeView({ tree }: { tree: TreeNode | null }) {
  if (!tree) return <span className="text-ink-subtle text-sm">null</span>;

  const root = hierarchy(toSlots(tree, "T"), (d) => d.children);
  d3tree<SlotNode>().nodeSize([NODE_R * 2.6, NODE_R * 3.4])(root);

  const nodes: PlacedNode[] = [];
  const edges: PlacedEdge[] = [];
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;

  root.each((n) => {
    minX = Math.min(minX, n.x!);
    maxX = Math.max(maxX, n.x!);
    maxY = Math.max(maxY, n.y!);
    nodes.push({ id: n.data.path, label: n.data.label, x: n.x!, y: n.y!, phantom: n.data.phantom });
    if (n.parent && !n.data.phantom && !n.parent.data.phantom) {
      edges.push({ id: n.data.path, x1: n.parent.x!, y1: n.parent.y!, x2: n.x!, y2: n.y! });
    }
  });

  const pad = NODE_R + 4;
  const width = maxX - minX + pad * 2;
  const height = maxY + pad * 2;
  const ox = -minX + pad;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {edges.map((e) => (
        <motion.line
          key={e.id}
          animate={{ x1: e.x1 + ox, y1: e.y1 + pad, x2: e.x2 + ox, y2: e.y2 + pad }}
          initial={false}
          transition={{ duration: 0.3 }}
          stroke="#3f3f46"
          strokeWidth={1.5}
        />
      ))}
      {nodes
        .filter((n) => !n.phantom)
        .map((n) => (
          <motion.g
            key={n.id}
            animate={{ x: n.x + ox, y: n.y + pad }}
            initial={{ x: n.x + ox, y: n.y + pad, opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <circle r={NODE_R} fill="#18181b" stroke="#52525b" strokeWidth={1.5} />
            <text textAnchor="middle" dominantBaseline="central" fill="#e4e4e7" fontSize={12}>
              {n.label}
            </text>
          </motion.g>
        ))}
    </svg>
  );
}

type WeightedEdge = { from: string; to: string; weight?: string | null };

function DagreGraph({ nodeIds, edgeList }: { nodeIds: Set<string>; edgeList: WeightedEdge[] }) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 24, ranksep: 36 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const id of nodeIds) g.setNode(id, { width: NODE_R * 2, height: NODE_R * 2 });
  for (const e of edgeList) g.setEdge(e.from, e.to);
  dagre.layout(g);

  const nodes = [...nodeIds].map((id) => {
    const n = g.node(id);
    return { id, x: n.x, y: n.y };
  });
  const edges = edgeList
    .map((e) => {
      const a = g.node(e.from);
      const b = g.node(e.to);
      return a && b
        ? { id: `${e.from}->${e.to}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, weight: e.weight }
        : null;
    })
    .filter(Boolean) as { id: string; x1: number; y1: number; x2: number; y2: number; weight?: string | null }[];

  const width = Math.max(...nodes.map((n) => n.x)) + NODE_R * 2;
  const height = Math.max(...nodes.map((n) => n.y)) + NODE_R * 2;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX={22} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#52525b" />
        </marker>
      </defs>
      {edges.map((e) => (
        <g key={e.id}>
          <motion.line
            animate={{ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 }}
            initial={false}
            transition={{ duration: 0.3 }}
            stroke="#3f3f46"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
          />
          {e.weight != null && (
            <motion.text
              animate={{ x: (e.x1 + e.x2) / 2 + 6, y: (e.y1 + e.y2) / 2 }}
              initial={false}
              fill="#a1a1aa"
              fontSize={10}
            >
              {e.weight}
            </motion.text>
          )}
        </g>
      ))}
      {nodes.map((n) => (
        <motion.g key={n.id} animate={{ x: n.x, y: n.y }} initial={false} transition={{ duration: 0.3 }}>
          <circle r={NODE_R} fill="#18181b" stroke="#52525b" strokeWidth={1.5} />
          <text textAnchor="middle" dominantBaseline="central" fill="#e4e4e7" fontSize={12}>
            {n.id}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

export function GraphView({ adjacency }: { adjacency: Record<string, (string | null)[]> }) {
  const nodeIds = new Set<string>(Object.keys(adjacency));
  const edgeList: WeightedEdge[] = [];
  for (const [from, targets] of Object.entries(adjacency)) {
    for (const t of targets) {
      if (t == null) continue;
      nodeIds.add(String(t));
      edgeList.push({ from, to: String(t) });
    }
  }
  return <DagreGraph nodeIds={nodeIds} edgeList={edgeList} />;
}

export function WeightedGraphView({
  weightedAdjacency,
}: {
  weightedAdjacency: Record<string, Record<string, string | null>>;
}) {
  const nodeIds = new Set<string>(Object.keys(weightedAdjacency));
  const edgeList: WeightedEdge[] = [];
  for (const [from, neighbors] of Object.entries(weightedAdjacency)) {
    for (const [to, weight] of Object.entries(neighbors)) {
      nodeIds.add(to);
      edgeList.push({ from, to, weight });
    }
  }
  return <DagreGraph nodeIds={nodeIds} edgeList={edgeList} />;
}

// Trie renders through the same slot-based d3 layout as binary trees, but with
// edge labels (the characters) and unlabeled nodes; terminal markers ($) shown filled.
export function TrieView({ trie }: { trie: TrieNode | null }) {
  if (!trie) return <span className="text-ink-subtle text-sm">empty</span>;

  type TrieSlot = { edge: string | null; terminal: boolean; path: string; children: TrieSlot[] };
  function toSlots(node: TrieNode, path: string): TrieSlot[] {
    return Object.entries(node).map(([edge, child]) => ({
      edge,
      terminal: child === null,
      path: path + "/" + edge,
      children: child ? toSlots(child, path + "/" + edge) : [],
    }));
  }

  const root: TrieSlot = { edge: null, terminal: false, path: "", children: toSlots(trie, "") };
  const h = hierarchy(root, (d) => d.children);
  d3tree<TrieSlot>().nodeSize([NODE_R * 2.6, NODE_R * 3])(h);

  const placed: { id: string; edge: string | null; terminal: boolean; x: number; y: number; px?: number; py?: number }[] = [];
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  h.each((n) => {
    minX = Math.min(minX, n.x!);
    maxX = Math.max(maxX, n.x!);
    maxY = Math.max(maxY, n.y!);
    placed.push({
      id: n.data.path || "root",
      edge: n.data.edge,
      terminal: n.data.terminal,
      x: n.x!,
      y: n.y!,
      px: n.parent?.x ?? undefined,
      py: n.parent?.y ?? undefined,
    });
  });

  const pad = NODE_R + 4;
  const ox = -minX + pad;
  const width = maxX - minX + pad * 2;
  const height = maxY + pad * 2;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {placed
        .filter((n) => n.px !== undefined)
        .map((n) => (
          <g key={"e" + n.id}>
            <motion.line
              animate={{ x1: n.px! + ox, y1: n.py! + pad, x2: n.x + ox, y2: n.y + pad }}
              initial={false}
              stroke="#3f3f46"
              strokeWidth={1.5}
            />
            <motion.text
              animate={{ x: (n.px! + n.x) / 2 + ox + 6, y: (n.py! + n.y) / 2 + pad }}
              initial={false}
              fill="#93c5fd"
              fontSize={11}
              fontFamily="monospace"
            >
              {n.edge}
            </motion.text>
          </g>
        ))}
      {placed.map((n) => (
        <motion.g key={n.id} animate={{ x: n.x + ox, y: n.y + pad }} initial={false}>
          <circle
            r={n.terminal ? 6 : 5}
            fill={n.terminal ? "#3b82f6" : "#18181b"}
            stroke="#52525b"
            strokeWidth={1.5}
          />
        </motion.g>
      ))}
    </svg>
  );
}

// Heap toggle view: renders a numeric array as the implicit binary tree
// (children of i at 2i+1 / 2i+2) — used when the heap invariant actually holds.
export function HeapTreeView({ values }: { values: (string | null)[] }) {
  function build(i: number): TreeNode | null {
    if (i >= values.length) return null;
    return { value: values[i], left: build(2 * i + 1), right: build(2 * i + 2) };
  }
  return <BinaryTreeView tree={build(0)} />;
}
