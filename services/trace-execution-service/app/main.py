from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import schemas
from .sandbox import start_trace

app = FastAPI(title="AlgoVision Trace Execution Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/trace")
def trace(payload: schemas.TraceRequest):
    start_trace(payload.session_id, payload.code)
    return {"status": "started", "session_id": payload.session_id}
