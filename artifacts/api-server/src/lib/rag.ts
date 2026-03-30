/**
 * RAG workflow implementation using a LangGraph-inspired state machine.
 *
 * Graph nodes:
 *   Node 1: retrieve   - embed query, search pgvector for top-k docs+tickets
 *   Node 2: evaluate   - check if retrieved context is sufficient
 *   Node 3a: generate  - if sufficient, produce answer with citations
 *   Node 3b: refine    - if insufficient, broaden query and re-retrieve (1 retry max)
 */

import { pool } from "@workspace/db";
import { embed } from "./embeddings.js";
import { logger } from "./logger.js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!,
});

const TOP_K = 5; // number of results per source

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Citation {
  id: number;
  type: "document" | "ticket";
  title: string;
  url?: string;
  snippet: string;
  score: number;
}

export interface RagState {
  query: string;
  embedding: number[];
  citations: Citation[];
  context: string;
  answer: string;
  sufficient: boolean;
  retrieval_steps: number;
}

// ─── Node 1: Retrieve ───────────────────────────────────────────────────────

async function retrieve(state: RagState): Promise<Partial<RagState>> {
  const { rows: docs } = await pool.query<{
    id: number; title: string; content: string; url: string; similarity: number;
  }>(
    `SELECT id, title, content, url,
            1 - (embedding <=> $1::vector) AS similarity
     FROM documents
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [`[${state.embedding.join(",")}]`, TOP_K]
  );

  const { rows: tickets } = await pool.query<{
    id: number; subject: string; conversation: string; ticket_id: string; similarity: number;
  }>(
    `SELECT id, subject, conversation, ticket_id,
            1 - (embedding <=> $1::vector) AS similarity
     FROM tickets
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [`[${state.embedding.join(",")}]`, TOP_K]
  );

  const citations: Citation[] = [
    ...docs.map((d) => ({
      id: d.id,
      type: "document" as const,
      title: d.title,
      url: d.url,
      snippet: d.content.slice(0, 300),
      score: parseFloat(String(d.similarity)),
    })),
    ...tickets.map((t) => ({
      id: t.id,
      type: "ticket" as const,
      title: t.subject,
      url: t.ticket_id ? `#${t.ticket_id}` : undefined,
      snippet: t.conversation.slice(0, 300),
      score: parseFloat(String(t.similarity)),
    })),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const context = citations
    .map((c, i) => `[${i + 1}] ${c.type.toUpperCase()} — ${c.title}\n${c.snippet}`)
    .join("\n\n");

  return { citations, context };
}

// ─── Node 2: Evaluate ───────────────────────────────────────────────────────

async function evaluate(state: RagState): Promise<Partial<RagState>> {
  // Feature-hashing vectors have lower absolute similarity scores than neural embeddings.
  // Consider context sufficient if we have at least 2 results (we always take top-k).
  const totalCount = state.citations.length;
  const sufficient = totalCount >= 2;

  logger.info({ totalCount, sufficient }, "Evaluated context sufficiency");
  return { sufficient };
}

// ─── Node 3a: Generate ──────────────────────────────────────────────────────

async function generate(state: RagState): Promise<Partial<RagState>> {
  const systemPrompt = `You are SupportBrainz, an AI assistant for customer support teams.
Answer the user's question using ONLY the provided context from documentation and support tickets.
Be concise and helpful. If the context doesn't fully answer the question, say so honestly.
Always reference the source material in your answer using [1], [2], etc. notation.`;

  const userPrompt = state.citations.length === 0
    ? `Question: ${state.query}\n\nNo relevant documentation or tickets were found. Please note this and suggest the user rephrase or contact support directly.`
    : `Context:\n${state.context}\n\nQuestion: ${state.query}\n\nAnswer based on the context above, citing sources with [1], [2], etc.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 600,
  });

  const raw = completion.choices[0]?.message?.content;
  logger.info({ finish_reason: completion.choices[0]?.finish_reason, raw_length: raw?.length ?? -1 }, "LLM generate response");
  const answer = (raw && raw.trim().length > 0) ? raw : "I couldn't generate an answer based on the available documentation. Please try rephrasing your question or contact support.";
  return { answer };
}

// ─── Node 3b: Refine & Re-retrieve ─────────────────────────────────────────

async function refineAndRetrieve(state: RagState): Promise<Partial<RagState>> {
  // Use the LLM to rephrase the query more broadly
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a query expansion assistant. Rephrase the given support question to be broader and more likely to match documentation. Return only the rephrased query.",
      },
      { role: "user", content: state.query },
    ],
    max_completion_tokens: 80,
  });

  const rawRefined = completion.choices[0]?.message?.content?.trim() ?? "";
  // Fall back to original query if LLM returns empty response
  const refinedQuery = rawRefined.length > 5 ? rawRefined : `${state.query} error issue problem`;
  logger.info({ original: state.query, refined: refinedQuery }, "Query refined");

  // Re-embed and re-retrieve with the broader query
  const newEmbedding = await embed(refinedQuery);
  const newState: RagState = { ...state, embedding: newEmbedding, query: refinedQuery };
  const retrieved = await retrieve(newState);

  return {
    ...retrieved,
    embedding: newEmbedding,
  };
}

// ─── Main RAG Entry Point ───────────────────────────────────────────────────

export async function runRag(query: string): Promise<{
  answer: string;
  citations: Citation[];
  retrieval_steps: number;
}> {
  logger.info({ query }, "Starting RAG workflow");

  // Embed the query
  const embedding = await embed(query);

  // Initialize workflow state
  let state: RagState = {
    query,
    embedding,
    citations: [],
    context: "",
    answer: "",
    sufficient: false,
    retrieval_steps: 1,
  };

  // Node 1: Retrieve
  state = { ...state, ...(await retrieve(state)) };

  // Node 2: Evaluate
  state = { ...state, ...(await evaluate(state)) };

  // Node 3: Generate or refine
  if (state.sufficient) {
    // Path A: context is good enough, generate directly
    state = { ...state, ...(await generate(state)) };
  } else {
    // Path B: refine query and retry (1 retry max)
    logger.info("Context insufficient, refining query...");
    state = { ...state, ...(await refineAndRetrieve(state)), retrieval_steps: 2 };

    // Re-evaluate after retry
    const reeval = await evaluate(state);
    state = { ...state, ...reeval };

    // Generate regardless after retry
    state = { ...state, ...(await generate(state)) };
  }

  logger.info({ answer_length: state.answer.length, citations: state.citations.length }, "RAG complete");

  return {
    answer: state.answer,
    citations: state.citations,
    retrieval_steps: state.retrieval_steps,
  };
}
