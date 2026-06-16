import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  listLeads,
  getLead,
  updateLeadStatus,
  addLeadNote,
  type ListLeadsParams,
} from "../services/leads/leadService";

const router = Router();

const VALID_STATUSES = ["new", "manual_review", "scheduled", "out_of_area", "contacted", "quoted", "lost"];
const VALID_SOURCES = ["quote", "manual_review", "schedule_request", "waitlist"];
const VALID_SORTS = ["created_at_desc", "created_at_asc", "last_seen_at_desc", "last_seen_at_asc"];

/**
 * GET /api/admin/leads
 * Lead Inbox list — query params:
 *   status   — filter by new|manual_review|scheduled|out_of_area|contacted|quoted|lost
 *   source   — filter by quote|manual_review|schedule_request|waitlist
 *   search   — matches name, email, phone, address, zip, county, state (case-insensitive substring)
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
 * Lead detail — full record, activity timeline, staff notes, and linked profile/
 * property/schedule request/subscription.
 */
router.get("/leads/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const detail = await getLead(id);
  if (!detail) return res.status(404).json({ error: "Lead not found" });
  res.json(detail);
});

/**
 * PATCH /api/admin/leads/:id
 * Manually update a lead's status. Body: { status, lost_reason? }
 * "lost" requires lost_reason. Status rank-check prevents unintentional
 * downgrades except to "lost" (terminal) or "new" (admin reset).
 */
router.patch("/leads/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, lost_reason } = req.body ?? {};

  if (!status || typeof status !== "string") {
    return res.status(400).json({ error: "status is required" });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  if (status === "lost" && !lost_reason?.trim()) {
    return res.status(400).json({ error: "lost_reason is required when status is 'lost'" });
  }

  try {
    const updated = await updateLeadStatus(id, status, lost_reason ?? null, req.adminUserId ?? null);
    if (!updated) return res.status(404).json({ error: "Lead not found" });
    res.json({ lead: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/admin/leads/:id/notes
 * Add a staff note to a lead. Body: { body: string }
 * Also writes a lead_activities row so the timeline reflects the note.
 */
router.post("/leads/:id/notes", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { body } = req.body ?? {};

  if (!body || typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ error: "Note body cannot be empty" });
  }

  try {
    const note = await addLeadNote(id, body, req.adminUserId ?? null);
    if (!note) return res.status(404).json({ error: "Lead not found or note could not be created" });
    res.status(201).json({ note });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
