import base64
import time

import docker
from docker.errors import ContainerError

_client = docker.from_env()

RUNNER_IMAGE = "python:3.12-slim"
TIME_LIMIT_S = 5
MEM_LIMIT = "256m"
NANO_CPUS = 500_000_000  # 0.5 vCPU
PIDS_LIMIT = 64


def _b64(s: str) -> str:
    return base64.b64encode(s.encode()).decode()


def run_in_sandbox(code: str, stdin: str) -> tuple[str, int, str | None]:
    """Runs `code` against `stdin` in a locked-down, network-disabled container.

    Returns (stdout, runtime_ms, error). error is 'timeout', 'runtime_error', or None.
    Both solution code and testcase input are embedded as base64 in the container
    command — avoids bind-mount path issues, since docker-py here talks to the HOST
    daemon (docker.sock is mounted in), not a filesystem this container's paths resolve in.
    """
    command = [
        "sh", "-c",
        f"echo {_b64(code)} | base64 -d > /tmp/s.py && "
        f"echo {_b64(stdin)} | base64 -d > /tmp/i.txt && "
        f"timeout {TIME_LIMIT_S} python /tmp/s.py < /tmp/i.txt",
    ]

    start = time.perf_counter()
    try:
        output = _client.containers.run(
            RUNNER_IMAGE,
            command,
            mem_limit=MEM_LIMIT,
            nano_cpus=NANO_CPUS,
            pids_limit=PIDS_LIMIT,
            network_disabled=True,
            remove=True,
            stdout=True,
            stderr=True,
        )
        runtime_ms = int((time.perf_counter() - start) * 1000)
        return output.decode(errors="replace"), runtime_ms, None
    except ContainerError as e:
        runtime_ms = int((time.perf_counter() - start) * 1000)
        if e.exit_status == 124:
            return "", runtime_ms, "timeout"
        return e.stderr.decode(errors="replace") if e.stderr else str(e), runtime_ms, "runtime_error"
