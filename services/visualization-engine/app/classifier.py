"""
Classifies raw DAP trace values into a renderer + normalized shape, per the
shape->renderer table in spec §2.1. This is the ONLY place structure detection
happens — it works purely from the shape of variable data already captured by
trace-execution-service, never from annotations or code style.
"""

import re

MAX_LINKED_LIST_NODES = 200
MAX_TREE_DEPTH = 12

PRIMITIVE_TYPES = {"int", "float", "str", "bool", "NoneType", "complex"}

_ADDR_RE = re.compile(r"0x[0-9a-f]+")


def _obj_id(val):
    """Stable-across-steps object identity, parsed from CPython's default repr
    ('<__main__.Node object at 0x7e55...>'). Cheap alias detection without an
    extra DAP round-trip per variable — good enough for pointer-aliasing badges."""
    m = _ADDR_RE.search(val.get("repr") or "")
    return m.group(0) if m else None


def _heap_property(values):
    """True when a numeric array of length >=3 satisfies the min-heap invariant
    (parent <= both children). A data property, not a usage guess — the frontend
    offers a heap-as-tree toggle only when it actually holds. Note sorted arrays
    trivially satisfy it, hence toggle rather than auto-switch."""
    if len(values) < 3:
        return False
    try:
        nums = [float(v) for v in values]
    except (TypeError, ValueError):
        return False
    return all(
        nums[i] <= nums[c]
        for i in range(len(nums))
        for c in (2 * i + 1, 2 * i + 2)
        if c < len(nums)
    )


def _trie_shape(val, depth=0):
    """Recursively convert a nested-dict trie into {label: subtree} edges.
    A dict is trie-shaped when every non-synthetic value is itself a dict
    (child node) or a primitive (terminal marker like {'$': True})."""
    fields = {k: v for k, v in (val.get("fields") or {}).items() if k != "len()"}
    if not fields or depth >= MAX_TREE_DEPTH:
        return None
    children = {}
    for k, v in fields.items():
        if v.get("type") == "dict":
            children[k] = _trie_shape(v, depth + 1) or {}
        elif v.get("type") in PRIMITIVE_TYPES:
            children[k] = None  # terminal marker
        else:
            return None  # non-dict, non-primitive value: not a trie
    return children


def _value_field(fields):
    """Node-shaped objects commonly name their payload val/value/data — grab whichever exists."""
    for key in ("val", "value", "data"):
        if key in fields:
            return fields[key]
    return None


def _is_indexed_list(fields):
    # pydevd adds synthetic non-index entries (e.g. "len()") alongside real
    # numeric indices on list/tuple/deque variables — ignore those, just
    # require at least one real index to treat it as an indexed sequence.
    return bool(fields) and any(k.isdigit() for k in fields.keys())


def _ordered_children(fields):
    return [fields[k] for k in sorted((k for k in fields.keys() if k.isdigit()), key=int)]


def classify_value(val):
    if not isinstance(val, dict):
        return {"type": "", "repr": str(val), "renderer": "scalar"}

    vtype = val.get("type", "")
    fields = val.get("fields")

    if not fields:
        return {**val, "renderer": "scalar"}

    if vtype in ("list", "tuple") and _is_indexed_list(fields):
        children = _ordered_children(fields)
        if children and all(_is_indexed_list(c.get("fields")) for c in children):
            rows = [[gc.get("repr") for gc in _ordered_children(c["fields"])] for c in children]
            return {**val, "renderer": "dp_table", "rows": rows}
        values = [c.get("repr") for c in children]
        return {**val, "renderer": "array", "values": values, "heap_property": _heap_property(values)}

    if vtype == "deque" and _is_indexed_list(fields):
        children = _ordered_children(fields)
        return {**val, "renderer": "queue", "values": [c.get("repr") for c in children]}

    if "next" in fields or "prev" in fields:
        nodes = []
        node_ids = []
        current = val
        seen = 0
        while current and current.get("fields") and seen < MAX_LINKED_LIST_NODES:
            f = current["fields"]
            value_field = _value_field(f)
            nodes.append(value_field.get("repr") if value_field else None)
            node_ids.append(_obj_id(current))
            nxt = f.get("next") or f.get("prev")
            if not nxt or nxt.get("repr") in (None, "None") or not nxt.get("fields"):
                break
            current = nxt
            seen += 1
        return {**val, "renderer": "linked_list", "nodes": nodes, "node_ids": node_ids, "obj_id": _obj_id(val)}

    if "left" in fields and "right" in fields:
        def walk(node, depth=0):
            if not node or not node.get("fields") or node.get("repr") == "None" or depth >= MAX_TREE_DEPTH:
                return None
            f = node["fields"]
            value_field = _value_field(f)
            return {
                "value": value_field.get("repr") if value_field else None,
                "left": walk(f.get("left"), depth + 1),
                "right": walk(f.get("right"), depth + 1),
            }
        return {**val, "renderer": "binary_tree", "tree": walk(val), "obj_id": _obj_id(val)}

    if vtype == "dict" and fields:
        # pydevd adds a synthetic "len()" entry on dicts too — ignore it for shape checks
        real_items = {k: v for k, v in fields.items() if k != "len()"}
        if real_items and all(c.get("type") in ("list", "set") for c in real_items.values()):
            adjacency = {
                k: [n.get("repr") for n in _ordered_children(v.get("fields") or {})]
                for k, v in real_items.items()
            }
            return {**val, "renderer": "graph", "adjacency": adjacency}
        # Weighted graph (Dijkstra-style): dict of node -> dict of neighbor -> numeric
        # weight. Empty neighbor-dicts are valid (isolated/sink nodes), but at least
        # one edge must exist somewhere or it's indistinguishable from a trie/hashmap.
        def _numeric_neighbors(v):
            inner = {gk: gv for gk, gv in (v.get("fields") or {}).items() if gk != "len()"}
            return all(gv.get("type") in ("int", "float") for gv in inner.values())

        if (
            real_items
            and all(v.get("type") == "dict" and _numeric_neighbors(v) for v in real_items.values())
            and any(
                gk != "len()" and gv.get("type") in ("int", "float")
                for v in real_items.values()
                for gk, gv in (v.get("fields") or {}).items()
            )
        ):
            weighted = {
                k: {gk: gv.get("repr") for gk, gv in (v.get("fields") or {}).items() if gk != "len()"}
                for k, v in real_items.items()
            }
            return {**val, "renderer": "weighted_graph", "weighted_adjacency": weighted}
        # Trie: nested dicts with primitive terminal markers, at least one dict child
        # (a flat all-primitive dict is a hashmap, handled below)
        has_dict_child = any(v.get("type") == "dict" for v in real_items.values())
        trie = _trie_shape(val) if has_dict_child else None
        if trie is not None:
            return {**val, "renderer": "trie", "trie": trie}
        if real_items and all(
            c.get("type") in PRIMITIVE_TYPES or not c.get("fields") for c in real_items.values()
        ):
            entries = {k: v.get("repr") for k, v in real_items.items()}
            return {**val, "renderer": "hashmap", "entries": entries}
        # other nested dicts fall through to object with classified children

    if vtype == "set" and fields:
        members = [v.get("repr") for k, v in fields.items() if k != "len()"]
        return {**val, "renderer": "array", "values": members}

    return {
        **val,
        "renderer": "object",
        "obj_id": _obj_id(val),
        "fields": {k: classify_value(v) for k, v in fields.items() if k != "len()"},
    }


def classify_frame(raw_frame: dict) -> dict:
    call_stack = raw_frame.get("call_stack", [])
    top_name = call_stack[0]["name"] if call_stack else None
    recursion_depth = sum(1 for f in call_stack if f["name"] == top_name) if top_name else 0

    return {
        "step": raw_frame.get("step"),
        "line": raw_frame.get("line"),
        "call_stack": call_stack,
        "variables": {name: classify_value(v) for name, v in raw_frame.get("locals", {}).items()},
        "stack_locals": [
            {
                "name": sl["name"],
                "line": sl["line"],
                "locals": {name: classify_value(v) for name, v in sl["locals"].items()},
            }
            for sl in raw_frame.get("stack_locals", [])
        ],
        "recursion": {"active": recursion_depth > 1, "depth": recursion_depth},
    }
