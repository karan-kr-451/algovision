"""
Runs inside the sandboxed trace-runner container. Drives debugpy's DAP adapter
to step through a user's script and emits one JSON line per step to stdout:
  {"step": int, "line": int, "locals": {...}, "call_stack": [...]}

This is the language-agnostic event schema from spec §2.1 — it must come from
a real DAP session, not a custom tracer (non-negotiable rule #2 in CLAUDE.md).
Steps into every call (not just over) so recursion depth is visible in call_stack.
"""
import json
import socket
import subprocess
import sys
import time

MAX_STEPS = 500
# ponytail: each step does several real DAP round-trips (stackTrace/scopes/variables,
# recursively for compound locals), so wall-clock cost grows with structure size —
# 45s covers small Tier-1 demo inputs. If this becomes the bottleneck for real usage,
# batch/parallelize the variable-expansion requests instead of raising this further.
WALL_CLOCK_LIMIT_S = 45
MAX_FRAMES = 20
MAX_CHILDREN = 30
MAX_EXPAND_DEPTH = 6

PRIMITIVE_TYPES = {"int", "float", "str", "bool", "NoneType", "complex"}


class DAPClient:
    def __init__(self, sock):
        self.sock = sock
        self.buf = b""
        self.seq = 0
        self.pending = {}

    def _read_message(self):
        while True:
            header_end = self.buf.find(b"\r\n\r\n")
            if header_end == -1:
                chunk = self.sock.recv(4096)
                if not chunk:
                    raise ConnectionError("adapter closed connection")
                self.buf += chunk
                continue
            header = self.buf[:header_end].decode()
            length = int(header.split("Content-Length:")[1].strip())
            body_start = header_end + 4
            while len(self.buf) < body_start + length:
                chunk = self.sock.recv(4096)
                if not chunk:
                    raise ConnectionError("adapter closed connection")
                self.buf += chunk
            body = self.buf[body_start:body_start + length]
            self.buf = self.buf[body_start + length:]
            return json.loads(body)

    def send_request(self, command, arguments=None):
        self.seq += 1
        seq = self.seq
        msg = {"seq": seq, "type": "request", "command": command}
        if arguments is not None:
            msg["arguments"] = arguments
        data = json.dumps(msg).encode()
        packet = f"Content-Length: {len(data)}\r\n\r\n".encode() + data
        self.sock.sendall(packet)
        return seq

    def read_until(self, predicate, timeout_s=10):
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            msg = self._read_message()
            if predicate(msg):
                return msg
        raise TimeoutError(f"timed out waiting for message matching {predicate}")


ADAPTER_PORT = 5678


def start_adapter():
    # debugpy.adapter prints no startup banner, so a fixed port is used instead
    # of trying to discover an OS-assigned one from stdout.
    # ponytail: stdout=PIPE is never drained in normal operation (only read here
    # on early-exit for diagnostics) — fine for short traced scripts, but a very
    # chatty debuggee could in theory fill the OS pipe buffer and stall the
    # adapter. Add a draining thread if that ever becomes a real problem.
    proc = subprocess.Popen(
        [sys.executable, "-u", "-m", "debugpy.adapter", "--host", "127.0.0.1", "--port", str(ADAPTER_PORT)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    # debugpy.adapter treats its first client connection as THE session — a probe
    # connect-then-close would make it think that session ended and exit. So the
    # first successful connection here is kept and reused as the real DAP socket.
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            sock = socket.create_connection(("127.0.0.1", ADAPTER_PORT), timeout=0.5)
            sock.settimeout(None)  # 0.5s connect timeout must not leak into the DAP session
            return proc, sock
        except OSError:
            if proc.poll() is not None:
                raise RuntimeError(f"adapter exited early: {proc.stdout.read()}")
            time.sleep(0.2)
    raise RuntimeError("adapter did not start listening in time")


def describe_value(client, var, depth=0, seen=None):
    """Recursively expand a DAP variable into a JSON-safe shape descriptor."""
    if seen is None:
        seen = set()
    var_type = var.get("type") or ""
    ref = var.get("variablesReference", 0)

    if var_type in PRIMITIVE_TYPES or ref == 0 or depth >= MAX_EXPAND_DEPTH:
        return {"type": var_type, "repr": var.get("value")}

    if ref in seen:
        return {"type": var_type, "repr": "<cycle>"}
    seen = seen | {ref}

    seq = client.send_request("variables", {"variablesReference": ref})
    resp = client.read_until(lambda m: m.get("type") == "response" and m.get("request_seq") == seq)
    children = resp.get("body", {}).get("variables", [])[:MAX_CHILDREN]

    fields = {}
    for child in children:
        name = child.get("name")
        if name and not name.startswith("__") and "special variables" not in name and "function variables" not in name:
            fields[name] = describe_value(client, child, depth + 1, seen)

    return {"type": var_type, "repr": var.get("value"), "fields": fields}


def _frame_locals(client, frame_id):
    result = {}
    seq = client.send_request("scopes", {"frameId": frame_id})
    scopes_resp = client.read_until(lambda m: m.get("type") == "response" and m.get("request_seq") == seq)
    for scope in scopes_resp.get("body", {}).get("scopes", []):
        if scope.get("name") not in ("Locals", "Local"):
            continue
        seq = client.send_request("variables", {"variablesReference": scope["variablesReference"]})
        vars_resp = client.read_until(lambda m: m.get("type") == "response" and m.get("request_seq") == seq)
        for var in vars_resp.get("body", {}).get("variables", []):
            name = var.get("name")
            if name and not name.startswith("__") and name not in ("special variables", "function variables"):
                result[name] = describe_value(client, var)
    return result


def capture_frame(client, step, thread_id, script_path):
    seq = client.send_request("stackTrace", {"threadId": thread_id, "startFrame": 0, "levels": MAX_FRAMES})
    resp = client.read_until(lambda m: m.get("type") == "response" and m.get("request_seq") == seq)
    frames = resp.get("body", {}).get("stackFrames", [])

    call_stack = [{"name": f["name"], "line": f["line"]} for f in frames]
    line = frames[0]["line"] if frames else None
    in_user_code = bool(frames) and frames[0].get("source", {}).get("path") == script_path

    if not in_user_code:
        return {
            "step": step, "line": line, "locals": {}, "call_stack": call_stack,
            "stack_locals": [], "in_user_code": False,
        }

    locals_out = _frame_locals(client, frames[0]["id"])

    # Locals for every user-code frame on the stack (not just the innermost) —
    # needed so a recursion tree can show each call level's variables at once.
    stack_locals = []
    for f in frames:
        if f.get("source", {}).get("path") != script_path:
            continue
        stack_locals.append({
            "name": f["name"],
            "line": f["line"],
            "locals": _frame_locals(client, f["id"]),
        })

    return {
        "step": step,
        "line": line,
        "locals": locals_out,
        "call_stack": call_stack,
        "stack_locals": stack_locals,
        "in_user_code": True,
    }


def _dbg(msg):
    print(f"[driver] {msg}", file=sys.stderr, flush=True)


def run(script_path, stdin_path):
    adapter_proc, sock = start_adapter()
    _dbg("connected to adapter")
    client = DAPClient(sock)

    try:
        _run_session(client, adapter_proc, script_path)
    finally:
        try:
            adapter_proc.terminate()
        except Exception:
            pass


def _run_session(client, adapter_proc, script_path):
    init_seq = client.send_request("initialize", {
        "clientID": "algovision",
        "adapterID": "debugpy",
        "linesStartAt1": True,
        "columnsStartAt1": True,
        "pathFormat": "path",
        "supportsVariableType": True,
        "supportsRunInTerminalRequest": False,
    })
    _dbg("sent initialize, waiting for its response")
    while True:
        msg = client._read_message()
        if msg.get("type") == "response" and msg.get("request_seq") == init_seq:
            break
    _dbg("got initialize response")

    # 'initialized' isn't sent until after 'launch' spawns the debuggee and its
    # in-process debugpy component attaches — waiting for it before launch would
    # deadlock. Send launch first, then wait for 'initialized' before configurationDone.
    client.send_request("launch", {
        "name": "trace",
        "type": "python",
        "request": "launch",
        "program": script_path,
        "console": "internalConsole",
        "stopOnEntry": True,
        "justMyCode": False,
        "redirectOutput": True,
        "cwd": "/tmp",
    })
    _dbg("sent launch, waiting for initialized event")
    while True:
        msg = client._read_message()
        _dbg(f"handshake recv {msg.get('type')} {msg.get('event') or msg.get('command')}")
        if msg.get("type") == "event" and msg.get("event") == "initialized":
            break
    _dbg("got initialized event")

    client.send_request("configurationDone")
    _dbg("sent configurationDone, entering main loop")

    start_time = time.time()
    step = 0
    raw_steps = 0
    MAX_RAW_STEPS = MAX_STEPS * 4  # backstop in case execution never (re-)enters user code

    while True:
        msg = client._read_message()
        mtype = msg.get("type")

        if mtype == "event" and msg.get("event") == "stopped":
            thread_id = msg["body"]["threadId"]
            raw_steps += 1
            frame = capture_frame(client, raw_steps, thread_id, script_path)

            if frame.pop("in_user_code"):
                step += 1
                frame["step"] = step
                print(json.dumps(frame), flush=True)

            timed_out = (time.time() - start_time) > WALL_CLOCK_LIMIT_S
            if step >= MAX_STEPS or raw_steps >= MAX_RAW_STEPS or timed_out:
                print(json.dumps({"type": "limit_exceeded", "steps": step}), flush=True)
                client.send_request("disconnect", {"terminateDebuggee": True})
                break

            client.send_request("stepIn", {"threadId": thread_id})

        elif mtype == "event" and msg.get("event") in ("terminated", "exited"):
            break

        elif mtype == "event" and msg.get("event") == "output":
            pass  # captured stdout is available here if needed later


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2])
