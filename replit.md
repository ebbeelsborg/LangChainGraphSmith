# SupportBrainz — Workspace

## Overview

**SupportBrainz** is an AI-powered customer support RAG assistant.

The backend has been migrated from TypeScript/Express to **Python/FastAPI**. The frontend remains React/Vite (TypeScript). The backend is a standalone Python application — it does NOT use the pnpm/TypeScript toolchain.

---

## Stack

### Backend (Python)
- **Language**: Python 3.11
- **Framework**: FastAPI + uvicorn
- **RAG workflow**: LangGraph (StateGraph with typed state)
- **LLM chains**: LangChain (LCEL — ChatPromptTemplate | ChatOpenAI | StrOutputParser)
- **LLM provider**: OpenAI via Replit AI Integrations proxy (env vars: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`)
- **Embeddings**: fastembed (`BAAI/bge-small-en-v1.5`, 384-dim, ONNX/CPU, no CUDA needed)
- **Database**: PostgreSQL with psycopg2 and pgvector extension
- **Observability**: LangSmith (env var: `LANGSMITH_API_KEY`, maps to `LANGCHAIN_API_KEY`)

### Frontend (TypeScript)
- **Framework**: React + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Query for API calls

### Shared
- **Database schema**: lib/db (Drizzle ORM) — `documents` and `tickets` tables with `vector(384)` columns
- **Monorepo**: pnpm workspaces (frontend only uses this; Python backend is standalone)

---

## Structure

```text
artifacts/
├── api-server/             Python FastAPI backend
│   ├── app.py              FastAPI app, all endpoints (/api/*)
│   ├── rag.py              LangGraph RAG state machine
│   ├── seed.py             Demo data (25 docs + 30 tickets) + seeding logic
│   ├── start.sh            uvicorn startup script (sets PATH for .pythonlibs)
│   └── .replit-artifact/
│       └── artifact.toml   run = "bash /home/runner/workspace/artifacts/api-server/start.sh"
│
└── support-brainz/         React frontend (Vite)
    └── src/
        ├── components/
        │   ├── chat/       ChatMessage, CitationCard, CitationModal
        │   └── layout/     Sidebar, TopBar
        ├── pages/
        │   └── ChatLayout.tsx  Main page with modal state
        └── lib/api.ts      API client

lib/db/                     Drizzle ORM schema (documents, tickets)
.pythonlibs/                Python venv (managed by uv/pip)
```

---

## API Endpoints

All endpoints are at `/api/*` on port 8080.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/healthz | Health check |
| POST | /api/chat | RAG query — body: `{query: string}` |
| GET | /api/seed/status | Returns `{seeded, document_count, ticket_count}` |
| POST | /api/seed | Truncate + re-seed with fastembed embeddings |
| GET | /api/documents/:id | Full document by DB row id |
| GET | /api/tickets/:id | Full ticket by DB row id |
| POST | /api/integrations/zendesk | Demo stub |
| POST | /api/integrations/confluence | Demo stub |

---

## LangGraph Workflow (rag.py)

```
START → retrieve → evaluate → generate → END
                ↘ refine → generate → END
```

- **retrieve**: embed query with fastembed, cosine-similarity search in pgvector (top 3 docs + top 5 tickets)
- **evaluate**: LLM judges if context is sufficient (returns "yes"/"no")
- **refine**: LLM rephrases the query, re-embeds, re-retrieves additional context
- **generate**: LLM generates answer with citation markers [1][2][3] from context

State type: `RAGState` (TypedDict) with fields: `query`, `embedding`, `citations`, `context`, `answer`, `sufficient`, `retrieval_steps`

---

## Database Schema

```sql
-- lib/db/src/schema/documents.ts
documents (id serial, title text, url text, content text, embedding vector(384))

-- lib/db/src/schema/tickets.ts  
tickets (id serial, ticket_id text, subject text, tags text[], conversation text, embedding vector(384))
```

Both tables use IVFFlat index: `CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)`
Must run `SET ivfflat.probes = 10` before each similarity query.

---

## Important Notes

### Python packages
Installed via `pip install` (not uv) since `uv` has issues with sentence-transformers/fastembed on Replit:
```bash
python3 -m pip install fastembed
```
Core packages installed via `installLanguagePackages`: fastapi, uvicorn, langchain, langchain-openai, langgraph, langsmith, psycopg2-binary, pgvector, python-multipart, numpy

### LangSmith tracing
Set in app.py startup: maps `LANGSMITH_API_KEY` → `LANGCHAIN_API_KEY`, sets `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_PROJECT=supportbrainz`. Tracing is non-critical — 403 errors from LangSmith don't affect functionality.

### LLM configuration
ChatOpenAI must NOT use `temperature` or `model_kwargs` for `max_completion_tokens`. Use direct parameters:
```python
ChatOpenAI(model="gpt-5-mini", api_key=..., base_url=..., max_completion_tokens=1024)
```
Using `model_kwargs={"max_completion_tokens": ...}` causes empty responses from the Replit proxy.

### Embedding model
fastembed downloads `BAAI/bge-small-en-v1.5` (~67MB ONNX) from HuggingFace on first use. The model is cached in the fastembed cache directory. After `run_seed()`, all vectors in the DB use this model's embedding space.

### Re-seeding
After any change to the embedding model, click "Load Demo Data" in the UI (or POST /api/seed) to TRUNCATE and re-seed with correct embeddings.

---

## Frontend Field Mapping

The frontend's Sidebar expects these field names from `/api/seed/status`:
- `seeded` (boolean)
- `document_count` (integer) — snake_case
- `ticket_count` (integer) — snake_case

The chat response from `/api/chat` returns:
- `answer` (string)
- `citations` (array of `{id, type, title, url?, ticketId?, score, index}`)
- `retrievalSteps` (integer)

Citations with `type: "document"` use `id` to fetch `/api/documents/{id}`.
Citations with `type: "ticket"` use `id` to fetch `/api/tickets/{id}`.
