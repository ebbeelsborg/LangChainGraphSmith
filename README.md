# SupportBrainz

SupportBrainz is an AI-powered customer support assistant that helps support teams answer tickets faster and more consistently. Instead of searching through wikis and old tickets manually, you ask a question in natural language and get a synthesised answer drawn directly from your knowledge base and ticket history — with numbered citations linking back to every source used.

---

## What it can help you with

- **Answer incoming support tickets** — paste a customer's question and get a draft answer grounded in your documentation
- **Search your knowledge base conversationally** — no Boolean queries, just plain English
- **Surface relevant past tickets** — find how similar issues were resolved before
- **Onboard new support agents** — point them at SupportBrainz instead of dozens of wiki pages
- **Reduce escalations** — common questions are answered instantly, freeing senior staff for edge cases

---

## Features

| Feature | Description |
|---|---|
| RAG-powered answers | Every answer is generated from retrieved documents and tickets, not from model memory |
| Numbered citations | Inline `[1]` `[2]` `[3]` markers match source cards below the answer |
| Full source viewer | Click any citation card to read the complete document or ticket in a modal |
| Suggested questions | Four ready-made queries on the welcome screen to explore the knowledge base |
| Demo data loader | One-click seed of 25 knowledge-base documents and 100 support tickets |
| Zendesk integration | Connect a Zendesk subdomain and API key to import live tickets |
| Confluence integration | Connect a Confluence space to pull in documentation pages |
| New Chat / Home | Clear the conversation and return to the welcome screen at any time |
| Dark UI | Full dark-mode chat interface built for all-day use |

---

## Tech stack

### RAG (Retrieval-Augmented Generation)

RAG is the core architecture of the application. When a user submits a query, the system does not ask the LLM to answer from memory. Instead it:

1. **Embeds** the query into a 384-dimensional vector
2. **Retrieves** the most semantically similar documents and tickets from PostgreSQL using pgvector
3. **Evaluates** whether the retrieved context is sufficient to answer the question
4. **Generates** an answer grounded in that context, or **refines** the query and re-retrieves if the context was insufficient (one automatic retry)
5. **Returns** the answer alongside numbered citations pointing to every source used

This guarantees that answers are traceable and hallucinations are minimised, since the LLM is constrained to the retrieved content.

---

### pgvector

pgvector is a PostgreSQL extension that adds a native `vector` column type and approximate nearest-neighbour search operators. SupportBrainz stores a 384-dimensional embedding alongside every document and ticket row. At query time, a single SQL statement ranks all rows by cosine similarity to the query embedding:

```sql
SELECT id, title, content,
       1 - (embedding <=> $1::vector) AS similarity
FROM documents
ORDER BY embedding <=> $1::vector
LIMIT 5
```

An `ivfflat` index (with `lists = 10` and `probes = 10` set inside a transaction) ensures the search is both fast and exhaustive — a critical tuning detail, since the default `probes = 1` caused relevant documents to be silently missed for sparse queries.

---

### LangChain

The retrieval and generation pipeline follows the same conceptual patterns that LangChain popularised: document loaders, text splitters, vector store retrievers, and prompt templates chained together. The current implementation replicates these patterns in TypeScript without the LangChain library as a direct dependency, which keeps the bundle lean and gives full control over retrieval logic (for example, the guaranteed-top-3-docs strategy that prevents long documents from being outranked by short keyword-dense tickets).

---

### LangGraph

The RAG workflow is modelled directly after LangGraph's node-based state machine concept. The pipeline is a directed graph with explicit typed state (`RagState`) that flows through named nodes:

```
retrieve → evaluate → generate
                   ↘ refine → retrieve (retry, max 1)
```

Each node is a pure function that receives the current state and returns a partial update. This makes the pipeline easy to reason about, test, and extend — the same design principle that drives LangGraph.

---

### LangSmith

LangSmith is the observability and tracing platform for LangChain-based applications. The current build uses structured JSON logging (via Pino) to record retrieval results, similarity scores, model finish reasons, and latency at each node. A LangSmith integration would replace this with a hosted trace UI, dataset management, and regression testing across prompt versions — a natural next step as the application matures.

---

### Python

The backend is currently implemented in **TypeScript running on Node.js**, not Python. This was chosen to keep the entire stack in one language (TypeScript end-to-end) and avoid native-module build issues in the Replit environment. A Python rewrite using the libraries below would be a straightforward migration, since the RAG architecture maps directly onto Python idioms.

---

### FastAPI

The API layer is currently implemented with **Express.js** (TypeScript). FastAPI would be the natural Python equivalent — both expose a REST API, validate request bodies, and serve JSON responses. The Express routes (`POST /api/chat`, `GET /api/documents/:id`, `GET /api/tickets/:id`, `POST /api/seed`, `POST /api/integrations/zendesk`, `POST /api/integrations/confluence`) would translate directly to FastAPI path operations.

---

### React

The entire frontend is a React single-page application built with Vite and styled with Tailwind CSS. Key React patterns in use:

- **Custom hooks** (`useChatState`) manage message history, pending state, and citation selection
- **React Query** (`@tanstack/react-query`) handles API calls, caching, and loading/error states
- **Framer Motion** provides animated message entrances, modal transitions, and suggestion card reveals
- **Component composition** — `ChatLayout` → `ChatMessage` → `CitationsList` → `CitationModal` — keeps each piece small and focused

---

### Replit LLM

Answer generation uses the **Replit AI Integrations proxy**, which exposes an OpenAI-compatible API endpoint. The model is `gpt-4o-mini`. Because the proxy is OpenAI-compatible, the standard `openai` npm package is used with the `baseURL` pointed at Replit's proxy and the key supplied by Replit's secret injection — no separate OpenAI account or API key is needed when running inside Replit.

```ts
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
```

---

## Project structure

```
artifacts/
  api-server/          Express API — RAG pipeline, seed, integrations
    src/lib/
      rag.ts           LangGraph-inspired state machine (retrieve → evaluate → generate/refine)
      embeddings.ts    384-dim feature-hash embeddings (pure TypeScript, zero deps)
      seed.ts          25 knowledge-base documents + 100 support tickets
  support-brainz/      React + Vite frontend
    src/
      pages/ChatLayout.tsx          Main chat layout, input, Home/New Chat buttons
      components/chat/
        ChatMessage.tsx             Per-message renderer with Markdown + citations
        Citations.tsx               Clickable citation cards with match scores
        CitationModal.tsx           Full-content modal (fetches doc/ticket by ID)
      components/layout/Sidebar.tsx Knowledge-base stats, demo seed, integrations
lib/
  api-client-react/    Auto-generated React Query hooks from OpenAPI spec
  db/                  PostgreSQL connection pool (shared across packages)
```

---

## Getting started

1. Open the project in Replit
2. Click **Load Demo Data** in the sidebar to seed the knowledge base
3. Type a question or click one of the four suggested queries
4. Click any citation card to read the full source document or ticket
