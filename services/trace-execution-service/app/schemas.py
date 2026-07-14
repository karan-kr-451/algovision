from pydantic import BaseModel


class TraceRequest(BaseModel):
    session_id: str
    code: str
    background: bool = False
