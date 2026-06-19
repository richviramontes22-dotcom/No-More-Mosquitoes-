import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireSales } from "../middleware/requireRole";

const db = supabaseAdmin ?? supabase;
const router = Router();

// GET /api/admin/sales/dashboard
// Read-only. Reuses the existing leads/referrals tables directly rather
// than duplicating their logic — this is a narrower, sales-scoped read
// view, not a parallel CRM.
router.get("/admin/sales/dashboard", requireSales, async (_req, res) => {
  try {
    const [{ data: leads }, { data: followups }, { data: codes }, { data: referrals }] = await Promise.all([
      db.from("leads").select("id, status, source, name, email, acreage, created_at").order("created_at", { ascending: false }).limit(50),
      db.from("lead_followups").select("id, lead_id, due_at, status").eq("status", "pending").lt("due_at", new Date().toISOString()),
      db.from("referral_codes").select("id, code, owner_type, partner_name, active"),
      db.from("referrals").select("id, referral_code_id, status, created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    const leadsByStatus: Record<string, number> = {};
    (leads ?? []).forEach((l: any) => { leadsByStatus[l.status] = (leadsByStatus[l.status] ?? 0) + 1; });

    const quoteRequestCount = (leads ?? []).filter((l: any) => l.source === "quote").length;

    res.json({
      recent_leads: leads ?? [],
      leads_by_status: leadsByStatus,
      quote_request_count: quoteRequestCount,
      overdue_followups_count: (followups ?? []).length,
      referral_codes: codes ?? [],
      recent_referrals: referrals ?? [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
