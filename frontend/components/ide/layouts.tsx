"use client";

import { hierarchy, tree as d3tree } from "d3-hierarchy";
import dagre from "@dagrejs/dagre";
import { motion } from "framer-motion";
import type { TreeNode } from "@/lib/api";

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
  if (!tree) return <span className="text-zinc-500 text-sm">null</span>;

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

export function GraphView({ adjacency }: { adjacency: Record<string, (string | null)[]> }) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 24, ranksep: 36 });
  g.setDefaultEdgeLabel(() => ({}));

  const ids = new Set<string>(Object.keys(adjacency));
  for (const targets of Object.values(adjacency)) {
    for (const t of targets) if (t != null) ids.add(String(t));
  }
  for (const id of ids) g.setNode(id, { width: NODE_R * 2, height: NODE_R * 2 });
  for (const [from, targets] of Object.entries(adjacency)) {
    for (const t of targets) if (t != null) g.setEdge(from, String(t));
  }
  dagre.layout(g);

  const nodes = [...ids].map((id) => {
    const n = g.node(id);
    return { id, x: n.x, y: n.y };
  });
  const edges: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const [from, targets] of Object.entries(adjacency)) {
    for (const t of targets) {
      if (t == null) continue;
      const a = g.node(from);
      const b = g.node(String(t));
      if (a && b) edges.push({ id: `${from}->${t}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }

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
        <motion.line
          key={e.id}
          animate={{ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 }}
          initial={false}
          transition={{ duration: 0.3 }}
          stroke="#3f3f46"
          strokeWidth={1.5}
          markerEnd="url(#arrow)"
        />
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
