import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

/**
 * GET /api/admin/service-area-demand
 * Returns recent demand events (quotes + waitlist signups) for ZIPs not in
 * our service area, aggregated by ZIP so admins can prioritize expansion.
 * Query params:
 *   limit — max raw events to aggregate from (default 200, max 500)
 */
router.get("/service-area-demand", requireAdmin, async (req, res) => {
  const rawLimit = parseInt(String(req.query.limit ?? ""), 10);
  const limitVal = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 500) : 200;

  const { data, error } = await db
    .from("service_area_demand_events")
    .select("zip, event_type, email, name, lead_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limitVal);

  if (error) return res.status(500).json({ error: error.message });

  type ZipSummary = {
    zip: string;
    total: number;
    out_of_area_quote: number;
    waitlist_signup: number;
    last_event_at: string;
  };

  const byZip: Record<string, ZipSummary> = {};
  for (const row of data ?? []) {
    if (!byZip[row.zip]) {
      byZip[row.zip] = {
        zip: row.zip,
        total: 0,
        out_of_area_quote: 0,
        waitlist_signup: 0,
        last_event_at: row.created_at,
      };
    }
    byZip[row.zip].total++;
    if (row.event_type === "out_of_area_quote") byZip[row.zip].out_of_area_quote++;
    if (row.event_type === "waitlist_signup") byZip[row.zip].waitlist_signup++;
  }

  const demand = Object.values(byZip).sort((a, b) => b.total - a.total);
  res.json({ demand, events: data ?? [] });
});

export default router;
