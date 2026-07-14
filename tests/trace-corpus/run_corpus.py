"""
Runs every corpus script through the REAL trace pipeline (trace-execution-service
sandbox -> debugpy DAP -> Redis -> visualization-engine classifier -> WebSocket)
and asserts the expected renderer(s) appear in at least one frame. No mocks
anywhere — this exercises exactly what the frontend consumes.

Usage: python run_corpus.py [name-filter]
Requires the docker compose stack running.
"""
import asyncio
import json
import sys
import urllib.request
import uuid

import websockets

from corpus import CORPUS

TRACE_API = "http://localhost:8004/trace"
VIZ_WS = "ws://localhost:8005/ws/visualize"
FRAME_TIMEOUT_S = 90


def collect_renderers(frame):
    found = set()

    def walk(value):
        if not isinstance(value, dict):
            return
        r = value.get("renderer")
        if r:
            found.add(r)
        for child in (value.get("fields") or {}).values():
            walk(child)

    for v in frame.get("variables", {}).values():
        walk(v)
    for sl in frame.get("stack_locals", []):
        for v in sl.get("locals", {}).values():
            walk(v)
    return found


async def run_one(name, code):
    session_id = f"corpus-{name}-{uuid.uuid4().hex[:8]}"
    frames = []
    ready = asyncio.Event()

    async def listen():
        async with websockets.connect(f"{VIZ_WS}/{session_id}") as ws:
            while True:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=FRAME_TIMEOUT_S))
                if msg.get("type") == "subscribed":
                    ready.set()
                    continue
                if msg.get("type") in ("trace_complete", "limit_exceeded"):
                    if msg.get("type") == "trace_complete":
                        break
                    continue
                frames.append(msg)

    task = asyncio.create_task(listen())
    await ready.wait()

    req = urllib.request.Request(
        TRACE_API,
        data=json.dumps({"session_id": session_id, "code": code}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req).read()
    await task
    return frames


async def main():
    name_filter = sys.argv[1] if len(sys.argv) > 1 else None
    passed, failed = [], []

    for name, expected, code in CORPUS:
        if name_filter and name_filter not in name:
            continue
        frames = await run_one(name, code)
        seen = set()
        recursion_active = False
        for f in frames:
            seen |= collect_renderers(f)
            if f.get("recursion", {}).get("active"):
                recursion_active = True

        missing = expected - seen
        extra_checks_ok = True
        if name == "recursion_fib" and not recursion_active:
            extra_checks_ok = False
            missing.add("recursion.active")

        if not missing and extra_checks_ok and frames:
            passed.append(name)
            print(f"PASS {name}: {len(frames)} frames, renderers={sorted(seen)}")
        else:
            failed.append(name)
            print(f"FAIL {name}: {len(frames)} frames, expected {sorted(expected)}, got {sorted(seen)}, missing {sorted(missing)}")

    print(f"\n{len(passed)} passed, {len(failed)} failed")
    if failed:
        print("failed:", failed)
        sys.exit(1)


asyncio.run(main())
