import { Router } from "express";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";
import { getLastPingsByEmployee, isStale } from "../services/tracking/lastPings";
import { getTechnicianStatusList } from "../services/tracking/technicianStatus";

const router = Router();
const db = supabaseAdmin ?? supabase;

/**
 * GET /api/admin/tracking/employees
 * Returns all active employees with real clock state, assignment status,
 * and (consent-respecting) last-known GPS location.
 */
router.get("/tracking/employees", requireAdmin, async (_req, res) => {
  try {
    const result = await getTechnicianStatusList();
    return res.json(result);
  } catch (err: any) {
    console.error("[AdminTracking] Unexpected error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/admin/tracking/employees/:id
 * Returns detailed status for a single employee, including real clock
 * state and (consent-respecting) last-known GPS location.
 */
router.get("/tracking/employees/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: emp, error: empErr } = await db
      .from("employees")
      .select("id, user_id, role, phone, status, gps_consent_at")
      .eq("id", id)
      .single();

    if (empErr || !emp) return res.status(404).json({ error: "Employee not found" });

    const today = format(new Date(), "yyyy-MM-dd");

    const [profileRes, assignmentsRes, openShiftRes, lastPingsByEmployee] = await Promise.all([
      db.from("profiles").select("name").eq("id", emp.user_id).maybeSingle(),
      db.from("assignments")
        .select(`id, status, en_route_at, arrived_at, started_at, completed_at, appointment_id, appointments ( scheduled_at, service_type, user_id, property_id )`)
        .eq("employee_id", id)
        .order("id", { ascending: false })
        .limit(10),
      db.from("shifts").select("id").eq("employee_id", id).eq("shift_date", today).is("clock_out_at", null).maybeSingle(),
      getLastPingsByEmployee([id]),
    ]);

    const assignments = assignmentsRes.data || [];
    const activeAssignment = assignments.find((a: any) => a.status === "en_route" || a.status === "in_progress");
    const clockedIn = !!openShiftRes.data;
    const hasConsent = !!emp.gps_consent_at;
    const lastPing = hasConsent ? lastPingsByEmployee.get(id) : null;
    const lastPingAt = lastPing?.captured_at ?? null;
    const location = hasConsent && lastPing ? { lat: Number(lastPing.latitude), lng: Number(lastPing.longitude) } : null;

    return res.json({
      id: emp.id,
      name: profileRes.data?.name || "Employee",
      role: emp.role,
      phone: emp.phone ?? null,
      status: emp.status,
      clocked_in: clockedIn,
      has_gps_consent: hasConsent,
      last_ping_at: lastPingAt,
      is_stale: clockedIn ? isStale(lastPingAt) : null,
      location_label: !location ? "unavailable" : (clockedIn && !isStale(lastPingAt)) ? "current" : "last_known",
      location,
      activeAssignment: activeAssignment ?? null,
      recentAssignments: assignments,
    });
  } catch (err: any) {
    console.error("[AdminTracking] Unexpected error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
