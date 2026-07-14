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
CONTAINER_WALL_CLOCK_LIMIT_S = 55  # backstop above driver.py's own internal 45s limit

_docker = docker.from_env()


def _b64(s: str) -> str:
    return base64.b64encode(s.encode()).decode()


def _publish(channel: str, payload: dict):
    r = redis.Redis.from_url(REDIS_URL)
    r.publish(channel, json.dumps(payload))
    r.close()


def run_trace(session_id: str, code: str):
    """Runs in a background thread. Streams driver.py's JSON-line frames onto
    a Redis pub/sub channel as they're produced — this service never classifies
    or renders them (that's visualization-engine's job, kept as a separate
    service per the sandbox/rendering separation rule)."""
    channel = f"trace:{session_id}"
    command = [
        "sh", "-c",
        f"echo {_b64(code)} | base64 -d > /tmp/s.py && "
        f"timeout {CONTAINER_WALL_CLOCK_LIMIT_S} python /opt/driver.py /tmp/s.py /dev/null",
    ]

    container = _docker.containers.run(
        RUNNER_IMAGE,
        command,
        mem_limit=MEM_LIMIT,
        nano_cpus=NANO_CPUS,
        pids_limit=PIDS_LIMIT,
        network_disabled=True,
        detach=True,
    )

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
        try:
            container.remove(force=True)
        except Exception:
            pass


def start_trace(session_id: str, code: str):
    t = threading.Thread(target=run_trace, args=(session_id, code), daemon=True)
    t.start()
