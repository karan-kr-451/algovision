from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import schemas
from .sandbox import CodeRejected, start_trace

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
    try:
        start_trace(payload.session_id, payload.code, background=payload.background)
    except CodeRejected as e:
        # 422: the buffer isn't eligible for a background run (parse error or
        # I/O calls). Frontend keeps showing the last good trace — spec §2.1.
        raise HTTPException(status_code=422, detail=str(e))
    return {"status": "started", "session_id": payload.session_id}
