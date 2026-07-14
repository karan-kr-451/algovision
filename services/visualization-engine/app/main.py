import json
import os

import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .classifier import classify_frame

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = FastAPI(title="AlgoVision Visualization Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/visualize/{session_id}")
async def visualize(websocket: WebSocket, session_id: str):
    await websocket.accept()
    r = redis.Redis.from_url(REDIS_URL)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"trace:{session_id}")
    # Redis pub/sub doesn't buffer — the caller must not POST /trace until this
    # subscribe has actually completed, not just until the WS handshake finished.
    await websocket.send_json({"type": "subscribed"})

    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            raw_frame = json.loads(message["data"])

            if raw_frame.get("type") in ("trace_complete", "limit_exceeded"):
                await websocket.send_json(raw_frame)
                if raw_frame.get("type") == "trace_complete":
                    break
                continue

            await websocket.send_json(classify_frame(raw_frame))
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"trace:{session_id}")
        await pubsub.close()
        await r.close()
