import { Router } from "express";
import { runRag } from "../lib/rag.js";

const router = Router();

// POST /api/chat — main RAG chat endpoint
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      res.status(400).json({ error: "Missing or invalid query" });
      return;
    }

    req.log.info({ query }, "Chat request received");
    const result = await runRag(query.trim());
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Chat endpoint error");
    res.status(500).json({ error: "Failed to generate response", detail: String(err) });
  }
});

export default router;
