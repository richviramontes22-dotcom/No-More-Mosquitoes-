import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * GET /api/admin/business-hours
 * Returns all business_hours rows ordered by day_of_week.
 * Includes day_name for UI display.
 */
router.get("/business-hours", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("business_hours")
    .select("id, day_of_week, is_operational, windows, service_area_id, updated_at")
    .is("service_area_id", null) // global schedule only for now
    .order("day_of_week", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const rows = (data || []).map((r: any) => ({
    ...r,
    day_name: DAY_NAMES[r.day_of_week] ?? `Day ${r.day_of_week}`,
  }));

  return res.json({ business_hours: rows });
});

/**
 * PATCH /api/admin/business-hours/:id
 * Updates a single business_hours row.
 * Accepts: { is_operational, windows }
 *
 * windows array item shape:
 *   { id: string, label: string, start: string, end: string, max_jobs_per_tech: number }
 */
router.patch("/business-hours/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_operational, windows } = req.body;

  if (is_operational === undefined && windows === undefined) {
    return res.status(400).json({ error: "Provide is_operational and/or windows to update" });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (is_operational !== undefined) updates.is_operational = Boolean(is_operational);
  if (windows !== undefined) {
    if (!Array.isArray(windows)) {
      return res.status(400).json({ error: "windows must be an array" });
    }
    updates.windows = windows;
  }

  const { data, error } = await db
    .from("business_hours")
    .update(updates)
    .eq("id", id)
    .select("id, day_of_week, is_operational, windows, updated_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Business hours row not found" });

  return res.json({ business_hours: { ...data, day_name: DAY_NAMES[data.day_of_week] ?? `Day ${data.day_of_week}` } });
});

export default router;
