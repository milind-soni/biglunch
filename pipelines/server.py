import os
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from sync import run

app = FastAPI()

WORKER_SECRET = os.environ.get("WORKER_SECRET", "")


class SyncRequest(BaseModel):
    provider: str
    connection_id: str
    nango_secret_key: str


@app.post("/sync")
def sync(req: SyncRequest, authorization: str = Header()):
    if authorization != f"Bearer {WORKER_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        result = run(req.provider, req.nango_secret_key, req.connection_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}
