import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

/**
 * GET /api/admin/alerts
 * Returns unresolved alerts, newest first.
 * Query params:
 *   severity  — filter by info|warning|critical
 *   limit     — default 50, max 200
 *   unresolved_only — "true" (default) | "false"
 */
router.get("/alerts", requireAdmin, async (req, res) => {
  const { severity, limit: rawLimit, unresolved_only } = req.query as Record<string, string>;

  const limit = Math.min(parseInt(rawLimit ?? "50", 10) || 50, 200);
  const onlyUnresolved = unresolved_only !== "false";

  let query = db
    .from("admin_alerts")
    .select("id, event_type, severity, title, body, entity_type, entity_id, metadata, acknowledged_at, resolved_at, notified_email, notified_sms, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (severity && ["info", "warning", "critical"].includes(severity)) {
    query = query.eq("severity", severity);
  }
  if (onlyUnresolved) {
    query = query.is("resolved_at", null);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ alerts: data ?? [] });
});

/**
 * GET /api/admin/alerts/counts
 * Returns unresolved alert counts by severity — powers the alert bell badge.
 */
router.get("/alerts/counts", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("admin_alerts")
    .select("severity")
    .is("resolved_at", null);

  if (error) return res.status(500).json({ error: error.message });

  const counts: Record<string, number> = { info: 0, warning: 0, critical: 0, total: 0 };
  for (const row of data ?? []) {
    counts[row.severity as string] = (counts[row.severity as string] ?? 0) + 1;
    counts.total += 1;
  }

  res.json(counts);
});

/**
 * POST /api/admin/alerts/:id/acknowledge
 * Marks an alert as acknowledged (admin has seen it).
 */
router.post("/alerts/:id/acknowledge", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await db
    .from("admin_alerts")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: req.adminUserId ?? null })
    .eq("id", id)
    .is("acknowledged_at", null)
    .select("id, acknowledged_at")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Alert not found or already acknowledged" });

  res.json({ ok: true, alert: data });
});

/**
 * POST /api/admin/alerts/:id/resolve
 * Marks an alert as resolved (issue addressed).
 */
router.post("/alerts/:id/resolve", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await db
    .from("admin_alerts")
    .update({
      resolved_at:   new Date().toISOString(),
      resolved_by:   req.adminUserId ?? null,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: req.adminUserId ?? null,
    })
    .eq("id", id)
    .is("resolved_at", null)
    .select("id, resolved_at")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Alert not found or already resolved" });

  res.json({ ok: true, alert: data });
});

export default router;
