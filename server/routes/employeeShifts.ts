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
 * GET /api/employee/shifts/current
 * Returns today's open shift (clock_out_at IS NULL) for the authenticated
 * employee, or { shift: null }. Read-only — exists so the dashboard knows
 * the real clocked-in state on page load/reload, not just within a single
 * session's local component state (which previously reset to "off duty" on
 * every reload regardless of an actually-open shift). This is what GPS
 * tracking gates on, so it has to be correct across reloads, not just
 * correct immediately after clicking "Clock In."
 */
router.get("/shifts/current", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: shift, error } = await db
    .from("shifts")
    .select("id, employee_id, shift_date, clock_in_at, clock_out_at, break_minutes")
    .eq("employee_id", actor.employeeId)
    .eq("shift_date", today)
    .is("clock_out_at", null)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ shift: shift ?? null });
});

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
 * POST /api/employee/shifts/location-ping
 *
 * Periodic GPS ping while clocked in — distinct from the existing
 * event-triggered ping in employeeAssignments.ts (which fires on en_route/
 * arrived status changes). This is the "still here" signal the client sends
 * on an interval while a shift is open.
 *
 * Every safeguard is enforced server-side, not just in the client's tracking
 * loop — a client can be tampered with, crash, or simply not stop cleanly,
 * so the server independently re-verifies on every single ping:
 *   1. Authenticated as a real, active employee.
 *   2. gps_consent_at is set (consent has not been withdrawn).
 *   3. An open shift exists today (clock_out_at IS NULL) — rejects pings
 *      sent while clocked out, even if the client thinks it's still tracking.
 */
router.post("/shifts/location-ping", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { latitude, longitude, accuracy } = req.body ?? {};
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({ error: "latitude and longitude are required" });
  }

  const { data: empData } = await db
    .from("employees")
    .select("gps_consent_at, is_test")
    .eq("id", actor.employeeId)
    .maybeSingle();

  if (!empData?.gps_consent_at) {
    return res.status(403).json({ error: "GPS consent not granted", code: "NO_CONSENT" });
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const { data: openShift } = await db
    .from("shifts")
    .select("id")
    .eq("employee_id", actor.employeeId)
    .eq("shift_date", today)
    .is("clock_out_at", null)
    .maybeSingle();

  if (!openShift) {
    return res.status(403).json({ error: "No open shift — clock in to enable tracking", code: "NOT_CLOCKED_IN" });
  }

  const { error } = await db.from("employee_location_pings").insert({
    employee_id: actor.employeeId,
    assignment_id: null,
    latitude,
    longitude,
    accuracy_meters: accuracy ?? null,
    status_trigger: "periodic",
    source: empData.is_test ? "simulated" : "browser",
    is_test: empData.is_test ?? false,
  });

  if (error) {
    console.error("[employeeShifts] location-ping insert error:", error.message);
    return res.status(500).json({ error: "Failed to record location" });
  }

  return res.json({ ok: true });
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
