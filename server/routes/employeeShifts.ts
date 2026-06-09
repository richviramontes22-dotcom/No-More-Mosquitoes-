import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { format } from "date-fns";

const router = Router();
const db = supabaseAdmin ?? supabase;

async function getAuthEmployee(req: any): Promise<{ userId: string; employeeId: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: emp } = await db
    .from("employees")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!emp) return null;
  return { userId: user.id, employeeId: emp.id };
}

/**
 * POST /api/employee/shifts/clock-in
 * Creates a shift record for today and sets clock_in_at.
 */
router.post("/shifts/clock-in", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const today = format(new Date(), "yyyy-MM-dd");

  // Check for an existing open shift today (no clock_out_at)
  const { data: existing } = await db
    .from("shifts")
    .select("id, clock_in_at")
    .eq("employee_id", actor.employeeId)
    .eq("shift_date", today)
    .is("clock_out_at", null)
    .maybeSingle();

  if (existing) {
    // Already clocked in — return existing shift
    return res.json({ shift: existing, already_clocked_in: true });
  }

  const now = new Date().toISOString();
  const { data: shift, error } = await db
    .from("shifts")
    .insert({
      employee_id: actor.employeeId,
      shift_date: today,
      clock_in_at: now,
      break_minutes: 0,
    })
    .select("id, employee_id, shift_date, clock_in_at, clock_out_at, break_minutes")
    .single();

  if (error) {
    console.error("[employeeShifts] clock-in error:", error.message);
    return res.status(500).json({ error: "Failed to clock in" });
  }

  console.log(`[employeeShifts] Employee ${actor.employeeId} clocked in — shift ${shift.id}`);
  return res.json({ shift });
});

/**
 * POST /api/employee/shifts/clock-out
 * Sets clock_out_at on an existing shift.
 */
router.post("/shifts/clock-out", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { shift_id } = req.body ?? {};
  const today = format(new Date(), "yyyy-MM-dd");

  // Resolve the shift: prefer explicit shift_id, fall back to today's open shift
  let resolvedShiftId = shift_id;
  if (!resolvedShiftId) {
    const { data: open } = await db
      .from("shifts")
      .select("id")
      .eq("employee_id", actor.employeeId)
      .eq("shift_date", today)
      .is("clock_out_at", null)
      .maybeSingle();
    resolvedShiftId = open?.id;
  }

  if (!resolvedShiftId) {
    return res.status(404).json({ error: "No open shift found for today" });
  }

  const now = new Date().toISOString();
  const { data: shift, error } = await db
    .from("shifts")
    .update({ clock_out_at: now })
    .eq("id", resolvedShiftId)
    .eq("employee_id", actor.employeeId)
    .select("id, employee_id, shift_date, clock_in_at, clock_out_at, break_minutes")
    .single();

  if (error) {
    console.error("[employeeShifts] clock-out error:", error.message);
    return res.status(500).json({ error: "Failed to clock out" });
  }

  console.log(`[employeeShifts] Employee ${actor.employeeId} clocked out — shift ${resolvedShiftId}`);
  return res.json({ shift });
});

/**
 * POST /api/employee/shifts/break/:action
 * Records a break start or end event via time_events.
 */
router.post("/shifts/break/:action", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { action } = req.params;
  if (action !== "start" && action !== "end") {
    return res.status(400).json({ error: "action must be start or end" });
  }

  const { shift_id } = req.body ?? {};
  if (!shift_id) return res.status(400).json({ error: "shift_id required" });

  const { data: shift } = await db
    .from("shifts")
    .select("id")
    .eq("id", shift_id)
    .eq("employee_id", actor.employeeId)
    .maybeSingle();

  if (!shift) return res.status(404).json({ error: "Shift not found" });

  const { error } = await db.from("time_events").insert({
    shift_id,
    event_type: action === "start" ? "break_start" : "break_end",
    ts: new Date().toISOString(),
  });

  if (error) return res.status(500).json({ error: "Failed to record break event" });

  return res.json({ ok: true });
});

/**
 * GET /api/employee/timesheets
 * Returns shifts for the authenticated employee within a date range.
 */
router.get("/timesheets", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { from, to } = req.query as Record<string, string>;

  const query = db
    .from("shifts")
    .select("id, employee_id, shift_date, clock_in_at, clock_out_at, break_minutes, notes")
    .eq("employee_id", actor.employeeId)
    .order("shift_date", { ascending: false });

  if (from) query.gte("shift_date", from);
  if (to) query.lte("shift_date", to);

  const { data: shifts, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ shifts: shifts || [] });
});

export default router;
