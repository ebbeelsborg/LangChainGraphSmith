import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

// GET /api/documents/:id — fetch full document content
router.get("/documents/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  try {
    const result = await pool.query(
      "SELECT id, title, content, url FROM documents WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch document");
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// GET /api/tickets/:id — fetch full ticket content
router.get("/tickets/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }
  try {
    const result = await pool.query(
      "SELECT id, subject, conversation, ticket_id FROM tickets WHERE id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch ticket");
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

export default router;
