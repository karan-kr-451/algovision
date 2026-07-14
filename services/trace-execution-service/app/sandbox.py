import ast
import base64
import json
import os
import threading

import docker
import redis

RUNNER_IMAGE = os.environ.get("TRACE_RUNNER_IMAGE", "algovision-trace-runner:latest")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

MEM_LIMIT = "256m"
NANO_CPUS = 500_000_000  # 0.5 vCPU
PIDS_LIMIT = 128  # debugpy's adapter+launcher+debuggee is a few processes, not one

# Explicit Run budget vs. tighter background (typing-pause) budget — spec §2.1 guard table.
FOREGROUND = {"steps": 500, "wall_s": 45, "container_s": 55}
BACKGROUND = {"steps": 300, "wall_s": 20, "container_s": 28}

# Module roots / builtins whose presence disables background auto-runs for a buffer
# (side effects must not re-fire on every typing pause). Explicit Run still allowed —
# the sandbox has no network and a throwaway filesystem either way.
IO_MODULES = {"socket", "urllib", "requests", "http", "subprocess", "shutil", "pathlib"}
IO_BUILTINS = {"open", "input"}

_docker = docker.from_env()

# One in-flight background run per session: a new typing pause supersedes the
# previous run rather than queueing behind it (spec §2.1).
_running: dict[str, object] = {}
_running_lock = threading.Lock()


class CodeRejected(Exception):
    pass


def check_background_eligible(code: str):
    """Parse gate + I/O static scan for background runs. Raises CodeRejected
    with a reason the frontend can show. ast.parse only parses — nothing executes."""
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise CodeRejected(f"syntax error: {e.msg} (line {e.lineno})")

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or ""]
            for name in names:
                if name.split(".")[0] in IO_MODULES:
                    raise CodeRejected(f"I/O module '{name}' — auto-run disabled, use explicit Run")
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in IO_BUILTINS:
            raise CodeRejected(f"'{node.func.id}()' call — auto-run disabled, use explicit Run")


def _b64(s: str) -> str:
    return base64.b64encode(s.encode()).decode()


def _publish(channel: str, payload: dict):
    r = redis.Redis.from_url(REDIS_URL)
    r.publish(channel, json.dumps(payload))
    r.close()


def run_trace(session_id: str, code: str, background: bool):
    """Runs in a background thread. Streams driver.py's JSON-line frames onto
    a Redis pub/sub channel as they're produced — this service never classifies
    or renders them (that's visualization-engine's job, kept as a separate
    service per the sandbox/rendering separation rule)."""
    budget = BACKGROUND if background else FOREGROUND
    channel = f"trace:{session_id}"
    command = [
        "sh", "-c",
        f"echo {_b64(code)} | base64 -d > /tmp/s.py && "
        f"timeout {budget['container_s']} python /opt/driver.py /tmp/s.py /dev/null",
    ]

    container = _docker.containers.run(
        RUNNER_IMAGE,
        command,
        environment={
            "TRACE_MAX_STEPS": str(budget["steps"]),
            "TRACE_WALL_CLOCK_S": str(budget["wall_s"]),
        },
        mem_limit=MEM_LIMIT,
        nano_cpus=NANO_CPUS,
        pids_limit=PIDS_LIMIT,
        network_disabled=True,
        detach=True,
    )

    with _running_lock:
        previous = _running.get(session_id)
        _running[session_id] = container
    if previous is not None:
        try:
            previous.remove(force=True)  # supersede: kill the older in-flight run
        except Exception:
            pass

    try:
        for line in container.logs(stream=True, stdout=True, stderr=False):
            text = line.decode(errors="replace").strip()
            if not text:
                continue
            try:
                frame = json.loads(text)
            except json.JSONDecodeError:
                continue  # driver.py's own [driver]-prefixed debug lines go to stderr, not stdout
            _publish(channel, frame)
    finally:
        _publish(channel, {"type": "trace_complete"})
        with _running_lock:
            if _running.get(session_id) is container:
                del _running[session_id]
        try:
            container.remove(force=True)
        except Exception:
            pass


def start_trace(session_id: str, code: str, background: bool = False):
    if background:
        check_background_eligible(code)
    t = threading.Thread(target=run_trace, args=(session_id, code, background), daemon=True)
    t.start()
