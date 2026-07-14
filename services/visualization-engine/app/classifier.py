"""
Classifies raw DAP trace values into a renderer + normalized shape, per the
shape->renderer table in spec §2.1. This is the ONLY place structure detection
happens — it works purely from the shape of variable data already captured by
trace-execution-service, never from annotations or code style.
"""

MAX_LINKED_LIST_NODES = 200
MAX_TREE_DEPTH = 12


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
        return {**val, "renderer": "array", "values": [c.get("repr") for c in children]}

    if vtype == "deque" and _is_indexed_list(fields):
        children = _ordered_children(fields)
        return {**val, "renderer": "queue", "values": [c.get("repr") for c in children]}

    if "next" in fields or "prev" in fields:
        nodes = []
        current = val
        seen = 0
        while current and current.get("fields") and seen < MAX_LINKED_LIST_NODES:
            f = current["fields"]
            value_field = _value_field(f)
            nodes.append(value_field.get("repr") if value_field else None)
            nxt = f.get("next") or f.get("prev")
            if not nxt or nxt.get("repr") in (None, "None") or not nxt.get("fields"):
                break
            current = nxt
            seen += 1
        return {**val, "renderer": "linked_list", "nodes": nodes}

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
        return {**val, "renderer": "binary_tree", "tree": walk(val)}

    if vtype == "dict" and fields and all(
        c.get("type") in ("list", "NoneType", "set") for c in fields.values()
    ):
        adjacency = {
            k: [n.get("repr") for n in _ordered_children(v.get("fields") or {})]
            for k, v in fields.items()
        }
        return {**val, "renderer": "graph", "adjacency": adjacency}

    return {**val, "renderer": "object", "fields": {k: classify_value(v) for k, v in fields.items()}}


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
