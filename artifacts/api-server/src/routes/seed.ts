import { Router } from "express";
import { seedDemoData, getSeedStatus } from "../lib/seed.js";

const router = Router();

// POST /api/seed — seed synthetic demo data
router.post("/", async (req, res) => {
  try {
    req.log.info("Starting demo data seed");
    const result = await seedDemoData();
    res.json({
      success: true,
      documents_seeded: result.documents_seeded,
      tickets_seeded: result.tickets_seeded,
      message: `Seeded ${result.documents_seeded} documents and ${result.tickets_seeded} tickets successfully.`,
    });
  } catch (err) {
    req.log.error({ err }, "Seed endpoint error");
    res.status(500).json({ error: "Failed to seed data", detail: String(err) });
  }
});

// GET /api/seed/status — check if demo data is loaded
router.get("/status", async (req, res) => {
  try {
    const status = await getSeedStatus();
    res.json(status);
  } catch (err) {
    req.log.error({ err }, "Seed status error");
    res.status(500).json({ error: "Failed to get seed status", detail: String(err) });
  }
});

export default router;
