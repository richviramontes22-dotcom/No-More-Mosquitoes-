import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireCustomerService } from "../middleware/requireRole";

const db = supabaseAdmin ?? supabase;
const router = Router();

// GET /api/admin/customer-service/dashboard
// Read-only. Composes existing data (tickets, satisfaction detractors,
// reschedule requests) — no new tables, no duplicated business logic.
router.get("/admin/customer-service/dashboard", requireCustomerService, async (_req, res) => {
  try {
    const [
      { data: openTickets },
      { data: escalatedTickets },
      { data: detractors },
      { data: rescheduleRequests },
      { data: recentActivity },
    ] = await Promise.all([
      db.from("tickets").select("id, subject, category, priority, status, user_id, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(25),
      db.from("tickets").select("id, subject, category, priority, status, user_id, created_at").eq("status", "escalated").order("created_at", { ascending: false }).limit(25),
      db.from("customer_satisfaction_surveys").select("id, rating, comment, issue_category, created_at, ticket_id").eq("satisfaction_type", "detractor").eq("followup_required", true).is("resolved_at", null).order("created_at", { ascending: false }),
      db.from("appointment_reschedule_requests").select("id, appointment_id, customer_id, preferred_date, preferred_window_label, status, created_at").eq("status", "pending").order("created_at", { ascending: false }),
      db.from("tickets").select("id, subject, status, updated_at").order("updated_at", { ascending: false }).limit(15),
    ]);

    res.json({
      open_tickets: openTickets ?? [],
      escalated_tickets: escalatedTickets ?? [],
      pending_detractors: detractors ?? [],
      pending_reschedule_requests: rescheduleRequests ?? [],
      recent_activity: recentActivity ?? [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/customer-service/customers?search=
router.get("/admin/customer-service/customers", requireCustomerService, async (req, res) => {
  // Strip characters with structural meaning in PostgREST's .or() filter
  // syntax (comma separates clauses, parens group, period separates
  // column.operator.value) so a search string can never inject additional
  // filter clauses.
  const search = String(req.query.search ?? "").trim().replace(/[,().]/g, "");
  if (!search) return res.json({ customers: [] });

  try {
    const { data, error } = await db
      .from("profiles")
      .select("id, name, email, phone, role")
      .eq("role", "customer")
      .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(20);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ customers: data ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
