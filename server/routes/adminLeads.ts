import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { listLeads, getLead, type ListLeadsParams } from "../services/leads/leadService";

const router = Router();

const VALID_STATUSES = ["new", "manual_review", "scheduled"];
const VALID_SOURCES = ["quote", "manual_review", "schedule_request"];
const VALID_SORTS = ["created_at_desc", "created_at_asc", "last_seen_at_desc", "last_seen_at_asc"];

/**
 * GET /api/admin/leads
 * Lead Inbox list — query params:
 *   status   — filter by new|manual_review|scheduled
 *   source   — filter by quote|manual_review|schedule_request
 *   search   — matches name, email, phone, or address (case-insensitive substring)
 *   sort     — created_at_desc (default) | created_at_asc | last_seen_at_desc | last_seen_at_asc
 *   page     — 1-based, default 1
 *   pageSize — default 25, max 100
 */
router.get("/leads", requireAdmin, async (req, res) => {
  const { status, source, search, sort, page, pageSize } = req.query as Record<string, string>;

  const result = await listLeads({
    status: status && VALID_STATUSES.includes(status) ? status : undefined,
    source: source && VALID_SOURCES.includes(source) ? source : undefined,
    search: search || undefined,
    sort: sort && VALID_SORTS.includes(sort) ? (sort as ListLeadsParams["sort"]) : undefined,
    page: page ? parseInt(page, 10) || 1 : undefined,
    pageSize: pageSize ? parseInt(pageSize, 10) || undefined : undefined,
  });

  res.json(result);
});

/**
 * GET /api/admin/leads/:id
 * Lead detail — full record, activity timeline, and linked profile/property/
 * schedule request/subscription (read-only).
 */
router.get("/leads/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const detail = await getLead(id);
  if (!detail) return res.status(404).json({ error: "Lead not found" });
  res.json(detail);
});

export default router;
