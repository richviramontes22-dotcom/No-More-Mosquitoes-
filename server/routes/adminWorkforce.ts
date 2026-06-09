import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { isTechnicianAvailable } from "../lib/technicianAvailability";
import { getEffectiveDailyCapacity } from "../lib/technicianCapacity";
import { validateDayPlanForWorkforce } from "../lib/workforceValidation";

const router = Router();
const db = supabaseAdmin ?? supabase;

async function requireAdmin(req: any, res: any): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) { res.status(401).json({ error: "Missing authorization" }); return null; }
  const { data: { user }, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !user) { res.status(401).json({ error: "Invalid session" }); return null; }
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") { res.status(403).json({ error: "Admin required" }); return null; }
  return user.id;
}

// ─── GET /api/admin/workforce/overview ────────────────────────────────────────

router.get("/workforce/overview", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const today = new Date().toISOString().slice(0, 10);

  const [empsRes, schedulesRes, capacityRes, blackoutsRes] = await Promise.all([
    db.from("employees").select("id").eq("status", "active").in("role", ["technician", "dispatcher"]),
    db.from("technician_schedule_templates").select("employee_id").limit(500),
    db.from("technician_capacity_profiles").select("employee_id").limit(500),
    db.from("blackout_dates").select("date, reason").gte("date", today).order("date", { ascending: true }).limit(5),
  ]);

  const activeEmpIds = new Set((empsRes.data || []).map((e: any) => e.id));
  const scheduledEmpIds = new Set((schedulesRes.data || []).map((s: any) => s.employee_id));
  const capacityEmpIds = new Set((capacityRes.data || []).map((c: any) => c.employee_id));

  const missingSchedules = [...activeEmpIds].filter(id => !scheduledEmpIds.has(id));
  const missingCapacity = [...activeEmpIds].filter(id => !capacityEmpIds.has(id));

  res.json({
    active_technicians: activeEmpIds.size,
    missing_schedules: missingSchedules.length,
    missing_capacity_profiles: missingCapacity.length,
    upcoming_blackouts: blackoutsRes.data || [],
    setup_complete: missingSchedules.length === 0 && missingCapacity.length === 0,
  });
});

// ─── Schedules ────────────────────────────────────────────────────────────────

router.get("/workforce/schedules", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { data, error } = await db
    .from("technician_schedule_templates")
    .select("id, employee_id, day_of_week, is_working, work_start, work_end, max_stops, effective_from, effective_until, notes")
    .order("employee_id")
    .order("day_of_week");

  if (error) return res.status(500).json({ error: error.message });
  res.json({ schedules: data || [] });
});

router.get("/workforce/schedules/:employeeId", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { employeeId } = req.params;
  const { date } = req.query as Record<string, string>;
  const checkDate = date || new Date().toISOString().slice(0, 10);

  const [schedRes, overrideRes, availRes] = await Promise.all([
    db.from("technician_schedule_templates")
      .select("id, day_of_week, is_working, work_start, work_end, max_stops, effective_from, effective_until, notes")
      .eq("employee_id", employeeId)
      .order("day_of_week"),
    db.from("technician_date_overrides")
      .select("id, override_date, is_available, work_start, work_end, max_stops_override, reason")
      .eq("employee_id", employeeId)
      .gte("override_date", checkDate)
      .order("override_date", { ascending: true })
      .limit(30),
    isTechnicianAvailable(employeeId, checkDate),
  ]);

  res.json({
    employee_id: employeeId,
    schedule_template: schedRes.data || [],
    upcoming_overrides: overrideRes.data || [],
    availability_today: availRes,
  });
});

router.post("/workforce/schedules/:employeeId", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { employeeId } = req.params;
  const { days, effective_from } = req.body;
  // days: Array<{ day_of_week, is_working, work_start, work_end, max_stops, notes }>

  if (!Array.isArray(days) || days.length === 0) {
    return res.status(400).json({ error: "days array required" });
  }

  const from = effective_from || new Date().toISOString().slice(0, 10);

  // Upsert each day
  const rows = days.map((d: any) => ({
    employee_id: employeeId,
    day_of_week: d.day_of_week,
    is_working: d.is_working ?? false,
    work_start: d.is_working ? (d.work_start ?? "08:00") : null,
    work_end: d.is_working ? (d.work_end ?? "17:00") : null,
    max_stops: d.max_stops ?? null,
    notes: d.notes ?? null,
    effective_from: from,
    created_by: adminId,
  }));

  const { error } = await db
    .from("technician_schedule_templates")
    .upsert(rows, { onConflict: "employee_id,day_of_week,effective_from" });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: `Schedule updated for ${days.length} days starting ${from}` });
});

router.patch("/workforce/schedules/:employeeId", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { employeeId } = req.params;
  const { days, effective_from } = req.body;
  if (!Array.isArray(days) || days.length === 0) return res.status(400).json({ error: "days array required" });

  const from = effective_from || new Date().toISOString().slice(0, 10);
  const rows = days.map((d: any) => ({
    employee_id: employeeId,
    day_of_week: d.day_of_week,
    is_working: d.is_working ?? false,
    work_start: d.is_working ? (d.work_start ?? "08:00") : null,
    work_end: d.is_working ? (d.work_end ?? "17:00") : null,
    max_stops: d.max_stops ?? null,
    notes: d.notes ?? null,
    effective_from: from,
    created_by: adminId,
  }));

  const { error } = await db
    .from("technician_schedule_templates")
    .upsert(rows, { onConflict: "employee_id,day_of_week,effective_from" });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Date Overrides ───────────────────────────────────────────────────────────

router.get("/workforce/overrides", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { employee_id, from, to } = req.query as Record<string, string>;
  const today = new Date().toISOString().slice(0, 10);

  let query = db
    .from("technician_date_overrides")
    .select("id, employee_id, override_date, is_available, work_start, work_end, max_stops_override, reason, created_at")
    .gte("override_date", from || today)
    .order("override_date", { ascending: true });

  if (employee_id) query = query.eq("employee_id", employee_id);
  if (to) query = query.lte("override_date", to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ overrides: data || [] });
});

router.post("/workforce/overrides", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { employee_id, override_date, is_available, work_start, work_end, max_stops_override, reason } = req.body;

  if (!employee_id || !override_date) {
    return res.status(400).json({ error: "employee_id and override_date required" });
  }

  const { data, error } = await db
    .from("technician_date_overrides")
    .upsert({
      employee_id,
      override_date,
      is_available: is_available ?? false,
      work_start: is_available ? work_start : null,
      work_end: is_available ? work_end : null,
      max_stops_override: max_stops_override ?? null,
      reason: reason ?? null,
      created_by: adminId,
    }, { onConflict: "employee_id,override_date" })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, override: data });
});

router.patch("/workforce/overrides/:id", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { is_available, work_start, work_end, max_stops_override, reason } = req.body;
  const updates: Record<string, any> = {};
  if (is_available !== undefined) updates.is_available = is_available;
  if (work_start !== undefined) updates.work_start = work_start;
  if (work_end !== undefined) updates.work_end = work_end;
  if (max_stops_override !== undefined) updates.max_stops_override = max_stops_override;
  if (reason !== undefined) updates.reason = reason;

  const { error } = await db.from("technician_date_overrides").update(updates).eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.delete("/workforce/overrides/:id", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { error } = await db.from("technician_date_overrides").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Capacity Profiles ────────────────────────────────────────────────────────

router.get("/workforce/capacity", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { data, error } = await db
    .from("technician_capacity_profiles")
    .select("*")
    .order("employee_id");

  if (error) return res.status(500).json({ error: error.message });
  res.json({ profiles: data || [] });
});

router.get("/workforce/capacity/:employeeId", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const today = new Date().toISOString().slice(0, 10);
  const [profileRes, effectiveRes] = await Promise.all([
    db.from("technician_capacity_profiles").select("*").eq("employee_id", req.params.employeeId).maybeSingle(),
    getEffectiveDailyCapacity(req.params.employeeId, today),
  ]);

  res.json({ profile: profileRes.data, effective_today: effectiveRes });
});

router.post("/workforce/capacity/:employeeId", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { employeeId } = req.params;
  const {
    max_stops_per_day, max_service_minutes_per_day, max_drive_minutes_per_day,
    allowed_service_types, skill_level, is_licensed_applicator,
    preferred_service_area_ids, home_base_lat, home_base_lng,
    home_base_address, vehicle_type, equipment_notes,
  } = req.body;

  const { data, error } = await db
    .from("technician_capacity_profiles")
    .upsert({
      employee_id: employeeId,
      max_stops_per_day: max_stops_per_day ?? 8,
      max_service_minutes_per_day: max_service_minutes_per_day ?? null,
      max_drive_minutes_per_day: max_drive_minutes_per_day ?? null,
      allowed_service_types: allowed_service_types ?? [],
      skill_level: skill_level ?? "standard",
      is_licensed_applicator: is_licensed_applicator ?? false,
      preferred_service_area_ids: preferred_service_area_ids ?? [],
      home_base_lat: home_base_lat ?? null,
      home_base_lng: home_base_lng ?? null,
      home_base_address: home_base_address ?? null,
      vehicle_type: vehicle_type ?? null,
      equipment_notes: equipment_notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "employee_id" })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, profile: data });
});

router.patch("/workforce/capacity/:employeeId", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const updates: Record<string, any> = {};
  const fields = ["max_stops_per_day", "max_service_minutes_per_day", "max_drive_minutes_per_day",
    "allowed_service_types", "skill_level", "is_licensed_applicator",
    "preferred_service_area_ids", "home_base_lat", "home_base_lng",
    "home_base_address", "vehicle_type", "equipment_notes"];

  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
  updates.updated_at = new Date().toISOString();

  const { error } = await db
    .from("technician_capacity_profiles")
    .update(updates)
    .eq("employee_id", req.params.employeeId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Workforce Validation ─────────────────────────────────────────────────────

router.get("/workforce/validation", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { date } = req.query as Record<string, string>;
  if (!date) return res.status(400).json({ error: "date query param required" });

  const result = await validateDayPlanForWorkforce(date);
  res.json(result);
});

export default router;
