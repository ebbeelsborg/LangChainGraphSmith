/**
 * External integration routes (Zendesk and Confluence POC).
 * These are lightweight API-call-only integrations for demonstration purposes.
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { embed } from "../lib/embeddings.js";

const router = Router();

// POST /api/integrations/zendesk
router.post("/zendesk", async (req, res) => {
  const { api_key, subdomain } = req.body;

  if (!api_key || !subdomain) {
    res.status(400).json({ error: "api_key and subdomain are required" });
    return;
  }

  try {
    req.log.info({ subdomain }, "Fetching Zendesk tickets");

    // Fetch recent tickets from Zendesk API
    const encodedCreds = Buffer.from(`${subdomain}/token:${api_key}`).toString("base64");
    const response = await fetch(
      `https://${subdomain}.zendesk.com/api/v2/tickets.json?sort_by=created_at&sort_order=desc&per_page=20`,
      {
        headers: {
          Authorization: `Basic ${encodedCreds}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      req.log.warn({ status: response.status, body }, "Zendesk API error");
      res.status(400).json({ error: "Zendesk API error", detail: `Status ${response.status}: ${body}` });
      return;
    }

    const data = (await response.json()) as { tickets: any[] };
    const tickets = data.tickets || [];
    let imported = 0;

    for (const ticket of tickets) {
      try {
        // Fetch comments for this ticket
        const commentsResp = await fetch(
          `https://${subdomain}.zendesk.com/api/v2/tickets/${ticket.id}/comments.json`,
          {
            headers: {
              Authorization: `Basic ${encodedCreds}`,
              "Content-Type": "application/json",
            },
          }
        );

        let conversation = ticket.description ?? "";
        if (commentsResp.ok) {
          const commentsData = (await commentsResp.json()) as { comments: any[] };
          conversation = commentsData.comments
            .map((c: any) => c.body)
            .join("\n\n---\n\n");
        }

        const tags = ticket.tags ?? [];
        const text = `${ticket.subject}\n\n${conversation}`;
        const embedding = await embed(text);

        await pool.query(
          `INSERT INTO tickets (ticket_id, subject, conversation, tags, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)
           ON CONFLICT DO NOTHING`,
          [String(ticket.id), ticket.subject, conversation, tags, `[${embedding.join(",")}]`]
        );
        imported++;
      } catch (innerErr) {
        req.log.warn({ innerErr, ticketId: ticket.id }, "Failed to import ticket");
      }
    }

    res.json({
      success: true,
      imported,
      message: `Imported ${imported} tickets from Zendesk.`,
    });
  } catch (err) {
    req.log.error({ err }, "Zendesk integration error");
    res.status(500).json({ error: "Failed to connect to Zendesk", detail: String(err) });
  }
});

// POST /api/integrations/confluence
router.post("/confluence", async (req, res) => {
  const { api_token, base_url, space_key } = req.body;

  if (!api_token || !base_url) {
    res.status(400).json({ error: "api_token and base_url are required" });
    return;
  }

  try {
    req.log.info({ base_url, space_key }, "Fetching Confluence pages");

    const cleanBase = base_url.replace(/\/$/, "");
    const spaceFilter = space_key ? `&spaceKey=${encodeURIComponent(space_key)}` : "";

    const response = await fetch(
      `${cleanBase}/rest/api/content?type=page&limit=20${spaceFilter}&expand=body.storage`,
      {
        headers: {
          Authorization: `Bearer ${api_token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      req.log.warn({ status: response.status, body }, "Confluence API error");
      res.status(400).json({ error: "Confluence API error", detail: `Status ${response.status}: ${body}` });
      return;
    }

    const data = (await response.json()) as { results: any[] };
    const pages = data.results || [];
    let imported = 0;

    for (const page of pages) {
      try {
        // Strip HTML from storage format
        const rawHtml = page.body?.storage?.value ?? "";
        const content = rawHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const url = `${cleanBase}/wiki/spaces/${page.space?.key}/pages/${page.id}`;

        const text = `${page.title}\n\n${content}`;
        const embedding = await embed(text);

        await pool.query(
          `INSERT INTO documents (title, content, url, embedding)
           VALUES ($1, $2, $3, $4::vector)
           ON CONFLICT DO NOTHING`,
          [page.title, content, url, `[${embedding.join(",")}]`]
        );
        imported++;
      } catch (innerErr) {
        req.log.warn({ innerErr, pageId: page.id }, "Failed to import page");
      }
    }

    res.json({
      success: true,
      imported,
      message: `Imported ${imported} pages from Confluence.`,
    });
  } catch (err) {
    req.log.error({ err }, "Confluence integration error");
    res.status(500).json({ error: "Failed to connect to Confluence", detail: String(err) });
  }
});

export default router;
