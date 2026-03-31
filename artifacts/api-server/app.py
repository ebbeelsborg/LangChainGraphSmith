import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor

# ─── LangSmith tracing setup (must be before other langchain imports) ──────────
# The SDK (0.7.x+) reads LANGSMITH_* env vars natively — no LANGCHAIN_* mapping needed.
# Env vars configured in Replit secrets:
#   LANGSMITH_API_KEY, LANGSMITH_TRACING, LANGSMITH_ENDPOINT, LANGSMITH_PROJECT
# Log what we see at startup to make key issues visible.
_ls_key = os.environ.get("LANGSMITH_API_KEY", "")
_ls_endpoint = os.environ.get("LANGSMITH_ENDPOINT", "(default)")
_ls_tracing = os.environ.get("LANGSMITH_TRACING", "(not set)")
_ls_project = os.environ.get("LANGSMITH_PROJECT", "(not set)")
# Log non-sensitive prefix only for diagnosis
import logging as _logging

_logging.basicConfig(level=_logging.INFO)
_logging.getLogger(__name__).info(
    f"LangSmith config — endpoint: {_ls_endpoint}, tracing: {_ls_tracing}, "
    f"project: {_ls_project}, key_set: {bool(_ls_key)}, key_prefix: {_ls_key[:12]}..."
)


import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(title="SupportBrainz API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = ThreadPoolExecutor(max_workers=4)


def get_db_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


# ─── Request/Response Models ──────────────────────────────────────────────────
class ChatRequest(BaseModel):
    query: str
    conversationHistory: list[dict] | None = []


class SeedRequest(BaseModel):
    pass


class ZendeskConfig(BaseModel):
    subdomain: str
    email: str
    apiToken: str


class ConfluenceConfig(BaseModel):
    domain: str
    email: str
    apiToken: str


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/api/healthz")
def healthz():
    return {"status": "ok", "version": "2.0.0", "backend": "FastAPI/Python"}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query is required")

    loop = asyncio.get_event_loop()
    try:
        from rag import run_rag

        result = await loop.run_in_executor(_executor, run_rag, req.query.strip())
        return result
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/seed/status")
def seed_status():
    from seed import get_seed_status

    return get_seed_status()


@app.post("/api/seed")
async def seed():
    loop = asyncio.get_event_loop()
    try:
        from seed import run_seed

        result = await loop.run_in_executor(_executor, run_seed)
        return result
    except Exception as e:
        logger.error(f"Seed error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int):
    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, title, url, content FROM documents WHERE id = %s",
                    (doc_id,),
                )
                row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets/{ticket_id}")
def get_ticket(ticket_id: int):
    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, ticket_id, subject, tags, conversation FROM tickets WHERE id = %s",
                    (ticket_id,),
                )
                row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Ticket not found")
        doc = dict(row)
        if doc.get("tags") is None:
            doc["tags"] = []
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get ticket error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/integrations/zendesk")
def connect_zendesk(config: ZendeskConfig):
    return {
        "success": True,
        "message": "Demo mode: Zendesk integration is simulated. In production, this would sync your tickets.",
        "demo": True,
    }


@app.post("/api/integrations/confluence")
def connect_confluence(config: ConfluenceConfig):
    return {
        "success": True,
        "message": "Demo mode: Confluence integration is simulated. In production, this would sync your documentation.",
        "demo": True,
    }


# ─── Legacy compatibility endpoints ───────────────────────────────────────────
@app.get("/api/documents")
def list_documents():
    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, title, url FROM documents ORDER BY id LIMIT 100"
                )
                rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"List documents error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets")
def list_tickets():
    try:
        with get_db_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, ticket_id, subject, tags FROM tickets ORDER BY id LIMIT 100"
                )
                rows = cur.fetchall()
        docs = []
        for r in rows:
            d = dict(r)
            if d.get("tags") is None:
                d["tags"] = []
            docs.append(d)
        return docs
    except Exception as e:
        logger.error(f"List tickets error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
