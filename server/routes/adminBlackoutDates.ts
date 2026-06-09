import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

/**
 * GET /api/admin/blackout-dates
 * Lists all blackout dates ordered by date ascending.
 */
router.get("/blackout-dates", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("blackout_dates")
    .select("id, date, reason, scope, service_area_id, created_at")
    .order("date", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ blackout_dates: data || [] });
});

/**
 * POST /api/admin/blackout-dates
 * Creates a new blackout date.
 *
 * Body:
 *   date            string (YYYY-MM-DD)   required
 *   reason          string                optional
 *   scope           "all" | "service_area" optional (default: "all")
 *   service_area_id UUID                  required when scope = "service_area"
 */
router.post("/blackout-dates", requireAdmin, async (req, res) => {
  const { date, reason, scope = "all", service_area_id } = req.body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date is required and must be YYYY-MM-DD" });
  }

  if (!["all", "service_area"].includes(scope)) {
    return res.status(400).json({ error: "scope must be 'all' or 'service_area'" });
  }

  if (scope === "service_area" && !service_area_id) {
    return res.status(400).json({ error: "service_area_id is required when scope is 'service_area'" });
  }

  // Count appointments affected by this blackout date so admin has context
  let affectedCount = 0;
  try {
    let countQuery = db
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_date", date)
      .not("status", "in", '("canceled","cancelled")');

    if (scope === "service_area" && service_area_id) {
      countQuery = countQuery.eq("service_area_id", service_area_id);
    }

    const { count } = await countQuery;
    affectedCount = count ?? 0;
  } catch {
    // Non-fatal — proceed without the count
  }

  const { data, error } = await db
    .from("blackout_dates")
    .insert({
      date,
      reason: reason || null,
      scope,
      service_area_id: scope === "service_area" ? service_area_id : null,
      created_by: req.adminUserId || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "A blackout date already exists for this date and scope" });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ blackout_date: data, affected_appointments: affectedCount });
});

/**
 * DELETE /api/admin/blackout-dates/:id
 * Removes a blackout date by ID.
 */
router.delete("/blackout-dates/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  const { error } = await db
    .from("blackout_dates")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
});

export default router;
