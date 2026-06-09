import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

/**
 * GET /api/admin/tracking/employees
 * Returns all active employees with their current assignment status from Supabase.
 *
 * NOTE: location (lat/lng) is NOT real GPS — no live tracking is implemented.
 * The location field is always null until Phase 3B wires real device coordinates.
 */
router.get("/tracking/employees", requireAdmin, async (_req, res) => {
  try {
    // Fetch all active employees with their profile names
    const { data: employees, error: empErr } = await db
      .from("employees")
      .select("id, user_id, role, phone, status")
      .eq("status", "active");

    if (empErr) {
      console.error("[AdminTracking] Employee query error:", empErr.message);
      return res.status(500).json({ error: "Failed to load employees" });
    }

    if (!employees || employees.length === 0) return res.json([]);

    const userIds = employees.map((e: any) => e.user_id).filter(Boolean);

    // Fetch profile names in one batch
    const { data: profiles } = await db
      .from("profiles")
      .select("id, name")
      .in("id", userIds);

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p.name || "Employee"; });

    // Fetch active assignments (en_route or in_progress) for these employees
    const employeeIds = employees.map((e: any) => e.id);
    const { data: activeAssignments } = await db
      .from("assignments")
      .select(`
        id,
        employee_id,
        status,
        en_route_at,
        appointment_id,
        appointments (
          user_id,
          property_id,
          service_type
        )
      `)
      .in("employee_id", employeeIds)
      .in("status", ["en_route", "in_progress"]);

    // Build assignment context map
    const apptUserIds = [...new Set(
      (activeAssignments || []).map((a: any) => a.appointments?.user_id).filter(Boolean)
    )];
    const apptPropIds = [...new Set(
      (activeAssignments || []).map((a: any) => a.appointments?.property_id).filter(Boolean)
    )];

    const [custProfiles, properties] = await Promise.all([
      apptUserIds.length > 0
        ? db.from("profiles").select("id, name").in("id", apptUserIds)
        : { data: [] },
      apptPropIds.length > 0
        ? db.from("properties").select("id, address").in("id", apptPropIds)
        : { data: [] },
    ]);

    const custMap: Record<string, string> = {};
    (custProfiles.data || []).forEach((p: any) => { custMap[p.id] = p.name || "Customer"; });

    const propMap: Record<string, string> = {};
    (properties.data || []).forEach((p: any) => { propMap[p.id] = p.address || ""; });

    // Build a map of employeeId → active assignment
    const activeMap: Record<string, any> = {};
    (activeAssignments || []).forEach((a: any) => {
      if (!activeMap[a.employee_id]) {
        activeMap[a.employee_id] = {
          id:            a.id,
          customer_name: custMap[a.appointments?.user_id] ?? "Customer",
          address:       propMap[a.appointments?.property_id] ?? "",
          status:        a.status,
          en_route_at:   a.en_route_at,
        };
      }
    });

    const result = employees.map((emp: any) => {
      const active = activeMap[emp.id] ?? null;
      return {
        id:         emp.id,
        name:       profileMap[emp.user_id] || "Employee",
        role:       emp.role,
        phone:      emp.phone ?? null,
        status:     active?.status || "idle",
        // GPS location is not implemented — no live device tracking exists yet.
        // This will be populated in Phase 3B when technician location reporting is added.
        location:   null,
        assignment: active
          ? { id: active.id, customer_name: active.customer_name, address: active.address }
          : null,
        lastUpdate: active?.en_route_at ?? null,
      };
    });

    return res.json(result);
  } catch (err: any) {
    console.error("[AdminTracking] Unexpected error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/admin/tracking/employees/:id
 * Returns detailed status for a single employee.
 */
router.get("/tracking/employees/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: emp, error: empErr } = await db
      .from("employees")
      .select("id, user_id, role, phone, status")
      .eq("id", id)
      .single();

    if (empErr || !emp) return res.status(404).json({ error: "Employee not found" });

    const { data: profile } = await db
      .from("profiles")
      .select("name")
      .eq("id", emp.user_id)
      .maybeSingle();

    // All assignments for this employee (recent first)
    const { data: assignments } = await db
      .from("assignments")
      .select(`
        id,
        status,
        en_route_at,
        arrived_at,
        started_at,
        completed_at,
        appointment_id,
        appointments (
          scheduled_at,
          service_type,
          user_id,
          property_id
        )
      `)
      .eq("employee_id", id)
      .order("id", { ascending: false })
      .limit(10);

    const activeAssignment = (assignments || []).find(
      (a: any) => a.status === "en_route" || a.status === "in_progress"
    );

    return res.json({
      id:               emp.id,
      name:             profile?.name || "Employee",
      role:             emp.role,
      phone:            emp.phone ?? null,
      status:           emp.status,
      // GPS not implemented — see GET /tracking/employees note above
      location:         null,
      activeAssignment: activeAssignment ?? null,
      recentAssignments: assignments || [],
    });
  } catch (err: any) {
    console.error("[AdminTracking] Unexpected error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
