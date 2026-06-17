import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  listLeads,
  getLead,
  updateLeadStatus,
  addLeadNote,
  assignLead,
  createFollowUp,
  updateFollowUpStatus,
  listFollowUps,
  type ListLeadsParams,
} from "../services/leads/leadService";

const router = Router();
const db = supabaseAdmin ?? supabase;

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
 * GET /api/admin/leads/staff
 * Lists admin/employee profiles eligible to be assigned a lead or follow-up.
 * Must be registered before GET /leads/:id, or "staff" would be parsed as a lead id.
 */
router.get("/leads/staff", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("profiles")
    .select("id, name, email")
    .in("role", ["admin", "employee"])
    .order("name", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ staff: data ?? [] });
});

/**
 * GET /api/admin/leads/followups
 * Cross-lead follow-up list — query params: status, assigned_to, due_before
 * Must be registered before GET /leads/:id, or "followups" would be parsed as a lead id.
 */
router.get("/leads/followups", requireAdmin, async (req, res) => {
  const { status, assigned_to, due_before } = req.query as Record<string, string>;
  const followups = await listFollowUps({
    status: status === "pending" || status === "completed" || status === "skipped" ? status : undefined,
    assignedTo: assigned_to || undefined,
    dueBefore: due_before || undefined,
  });
  res.json({ followups });
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

/**
 * POST /api/admin/leads/:id/assign
 * Assigns a lead to a staff member. Body: { assigned_to: profileId }
 * Writes a lead_assignments history row and updates leads.assigned_to.
 */
router.post("/leads/:id/assign", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { assigned_to } = req.body ?? {};

  if (!assigned_to || typeof assigned_to !== "string") {
    return res.status(400).json({ error: "assigned_to is required" });
  }

  const updated = await assignLead(id, assigned_to, req.adminUserId ?? null);
  if (!updated) return res.status(404).json({ error: "Lead not found or assignment failed" });
  res.json({ lead: updated });
});

/**
 * POST /api/admin/leads/:id/followups
 * Body: { due_at, assigned_to?, notes? }
 */
router.post("/leads/:id/followups", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { due_at, assigned_to, notes } = req.body ?? {};

  if (!due_at || typeof due_at !== "string") {
    return res.status(400).json({ error: "due_at is required" });
  }

  const followup = await createFollowUp({
    leadId: id,
    dueAt: due_at,
    assignedTo: assigned_to ?? null,
    notes: notes ?? null,
    createdBy: req.adminUserId ?? null,
  });
  if (!followup) return res.status(400).json({ error: "Failed to create follow-up" });
  res.status(201).json({ followup });
});

/**
 * PATCH /api/admin/leads/followups/:followupId
 * Body: { status: "completed" | "skipped" }
 */
router.patch("/leads/followups/:followupId", requireAdmin, async (req, res) => {
  const { followupId } = req.params;
  const { status } = req.body ?? {};

  if (status !== "completed" && status !== "skipped") {
    return res.status(400).json({ error: "status must be 'completed' or 'skipped'" });
  }

  const followup = await updateFollowUpStatus(followupId, status, req.adminUserId ?? null);
  if (!followup) return res.status(404).json({ error: "Follow-up not found" });
  res.json({ followup });
});

export default router;
