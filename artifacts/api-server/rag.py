import os
import logging
from typing import TypedDict, List, Optional, Any

from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langsmith import traceable

import psycopg2
import psycopg2.extras
from fastembed import TextEmbedding

logger = logging.getLogger(__name__)

# ─── Embedding Model (fastembed, ONNX-based, no CUDA) ──────────────────────────
# Cache the model inside the workspace so it is bundled into the deployment image
# and does not need to download from HuggingFace at runtime.
_MODEL_CACHE_DIR = os.path.join(os.path.dirname(__file__), ".model_cache")
_embedding_model: Optional[TextEmbedding] = None

def get_embedding_model() -> TextEmbedding:
    global _embedding_model
    if _embedding_model is None:
        logger.info(f"Loading fastembed model: BAAI/bge-small-en-v1.5 (cache: {_MODEL_CACHE_DIR})")
        _embedding_model = TextEmbedding(
            model_name="BAAI/bge-small-en-v1.5",
            cache_dir=_MODEL_CACHE_DIR,
        )
    return _embedding_model

@traceable(run_type="embedding", name="fastembed_bge_small")
def embed_text(text: str) -> List[float]:
    model = get_embedding_model()
    embeddings = list(model.embed([text]))
    return embeddings[0].tolist()


# ─── LLM (OpenAI via Replit AI Integrations proxy) ────────────────────────────
def get_llm() -> ChatOpenAI:
    base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
    api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY", "placeholder")
    return ChatOpenAI(
        model="gpt-5-mini",
        api_key=api_key,
        base_url=base_url,
        max_completion_tokens=1024,
    )


# ─── LangGraph State ──────────────────────────────────────────────────────────
class RAGState(TypedDict):
    query: str
    embedding: List[float]
    citations: List[dict]
    context: str
    answer: str
    sufficient: bool
    retrieval_steps: int


# ─── Database helpers ─────────────────────────────────────────────────────────
def get_db_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def vector_to_pg(vec: List[float]) -> str:
    return "[" + ",".join(str(v) for v in vec) + "]"


@traceable(run_type="retriever", name="pgvector_similarity_search")
def retrieve_similar(embedding: List[float], table: str, limit: int) -> List[dict]:
    vec_str = vector_to_pg(embedding)
    with get_db_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SET ivfflat.probes = 10")
            if table == "documents":
                cur.execute(
                    """
                    SELECT id, title, url, content,
                           1 - (embedding <=> %s::vector) AS score
                    FROM documents
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (vec_str, vec_str, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, ticket_id, subject, tags, conversation,
                           1 - (embedding <=> %s::vector) AS score
                    FROM tickets
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (vec_str, vec_str, limit),
                )
            return [dict(r) for r in cur.fetchall()]


# ─── Prompts ──────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are SupportBrainz, an expert AI assistant for customer support teams.

Answer the user's question using ONLY the information from the provided context.
Context includes both documentation articles and resolved support tickets.

Rules:
- Cite sources using [1], [2], ... notation matching the numbered citations below.
- Be concise but complete. Prefer bullet points for multi-step instructions.
- If the context does not fully answer the question, say so honestly and suggest what additional info would help.
- Do NOT make up information not present in the context.
"""

GENERATE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "Context (cite these sources):\n{context}\n\nQuestion: {query}"),
])

REFINE_SYSTEM = """You are a search query optimizer for a customer support knowledge base.
Your job is to rephrase the user's question to be broader and more likely to match 
documentation or support tickets. Return ONLY the rephrased query, nothing else."""

REFINE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", REFINE_SYSTEM),
    ("human", "Original question: {query}\n\nRephrased search query:"),
])

EVALUATE_SYSTEM = """You are evaluating whether retrieved context is sufficient to answer a support question.
Respond with ONLY 'yes' or 'no'. Yes means the context contains enough information to give a useful answer."""

EVALUATE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", EVALUATE_SYSTEM),
    ("human", "Question: {query}\n\nContext:\n{context}\n\nIs the context sufficient? (yes/no):"),
])


# ─── Format citations & context ───────────────────────────────────────────────
def build_citations_and_context(docs: List[dict], tickets: List[dict]) -> tuple[List[dict], str]:
    citations = []
    context_parts = []

    for i, doc in enumerate(docs, start=1):
        score = float(doc.get("score", 0))
        citations.append({
            "id": doc["id"],
            "type": "document",
            "title": doc["title"],
            "url": doc.get("url", ""),
            "score": score,
            "index": i,
        })
        context_parts.append(
            f"[{i}] DOCUMENTATION: {doc['title']}\n{doc['content'][:800]}"
        )

    offset = len(docs)
    for i, ticket in enumerate(tickets, start=offset + 1):
        score = float(ticket.get("score", 0))
        citations.append({
            "id": ticket["id"],
            "type": "ticket",
            "title": f"{ticket['ticket_id']}: {ticket['subject']}",
            "ticketId": ticket["ticket_id"],
            "score": score,
            "index": i,
        })
        tags_str = ", ".join(ticket.get("tags", []) or [])
        context_parts.append(
            f"[{i}] SUPPORT TICKET {ticket['ticket_id']}: {ticket['subject']}\n"
            f"Tags: {tags_str}\n{ticket['conversation'][:600]}"
        )

    context = "\n\n---\n\n".join(context_parts)
    return citations, context


# ─── LangGraph Nodes ──────────────────────────────────────────────────────────
@traceable(run_type="retriever", name="retrieve_node")
def retrieve_node(state: RAGState) -> dict:
    query = state["query"]
    embedding = embed_text(query)

    docs = retrieve_similar(embedding, "documents", 3)
    tickets = retrieve_similar(embedding, "tickets", 5)

    citations, context = build_citations_and_context(docs, tickets)

    return {
        "embedding": embedding,
        "citations": citations,
        "context": context,
        "retrieval_steps": state.get("retrieval_steps", 0) + 1,
    }


@traceable(run_type="llm", name="evaluate_node")
def evaluate_node(state: RAGState) -> dict:
    if not state.get("context") or len(state["context"]) < 100:
        return {"sufficient": False}

    try:
        llm = get_llm()
        chain = EVALUATE_PROMPT | llm | StrOutputParser()
        result = chain.invoke({"query": state["query"], "context": state["context"][:2000]})
        sufficient = result.strip().lower().startswith("yes")
    except Exception as e:
        logger.warning(f"Evaluate node error: {e}; defaulting to sufficient=True")
        sufficient = True

    return {"sufficient": sufficient}


@traceable(run_type="chain", name="refine_node")
def refine_node(state: RAGState) -> dict:
    try:
        llm = get_llm()
        chain = REFINE_PROMPT | llm | StrOutputParser()
        refined_query = chain.invoke({"query": state["query"]})
        refined_query = refined_query.strip()
    except Exception as e:
        logger.warning(f"Refine node error: {e}; using original query")
        refined_query = state["query"]

    new_embedding = embed_text(refined_query)
    docs = retrieve_similar(new_embedding, "documents", 3)
    tickets = retrieve_similar(new_embedding, "tickets", 5)

    all_ids = {c["id"] for c in state.get("citations", [])}
    new_docs = [d for d in docs if d["id"] not in all_ids]
    new_tickets = [t for t in tickets if t["id"] not in all_ids]

    existing_citations = state.get("citations", [])
    new_citations, new_context = build_citations_and_context(new_docs, new_tickets)

    merged_citations = existing_citations + new_citations
    merged_context = state.get("context", "") + "\n\n---\n\n" + new_context if new_context else state.get("context", "")

    return {
        "citations": merged_citations[:8],
        "context": merged_context,
        "sufficient": True,
    }


@traceable(run_type="llm", name="generate_node")
def generate_node(state: RAGState) -> dict:
    try:
        llm = get_llm()
        chain = GENERATE_PROMPT | llm | StrOutputParser()
        answer = chain.invoke({"query": state["query"], "context": state["context"][:6000]})
    except Exception as e:
        logger.error(f"Generate node error: {e}")
        answer = "I'm sorry, I encountered an error generating a response. Please try again."

    return {"answer": answer.strip()}


# ─── Routing ──────────────────────────────────────────────────────────────────
def route_after_evaluate(state: RAGState) -> str:
    if state.get("sufficient") or state.get("retrieval_steps", 0) >= 2:
        return "generate"
    return "refine"


# ─── Build Graph ──────────────────────────────────────────────────────────────
def build_rag_graph():
    builder = StateGraph(RAGState)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("evaluate", evaluate_node)
    builder.add_node("generate", generate_node)
    builder.add_node("refine", refine_node)

    builder.set_entry_point("retrieve")
    builder.add_edge("retrieve", "evaluate")
    builder.add_conditional_edges(
        "evaluate",
        route_after_evaluate,
        {"generate": "generate", "refine": "refine"},
    )
    builder.add_edge("refine", "generate")
    builder.add_edge("generate", END)

    return builder.compile()


_rag_graph = None

def get_rag_graph():
    global _rag_graph
    if _rag_graph is None:
        _rag_graph = build_rag_graph()
    return _rag_graph


# ─── Public entrypoint ────────────────────────────────────────────────────────
@traceable(run_type="chain", name="run_rag")
def run_rag(query: str) -> dict:
    graph = get_rag_graph()
    initial_state: RAGState = {
        "query": query,
        "embedding": [],
        "citations": [],
        "context": "",
        "answer": "",
        "sufficient": False,
        "retrieval_steps": 0,
    }
    result = graph.invoke(initial_state)
    citations = result.get("citations", [])
    citations.sort(key=lambda c: c.get("score", 0), reverse=True)

    return {
        "answer": result.get("answer", ""),
        "citations": citations[:8],
        "retrievalSteps": result.get("retrieval_steps", 1),
    }
