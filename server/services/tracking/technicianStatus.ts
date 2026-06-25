import { format } from "date-fns";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getLastPingsByEmployee, isStale } from "./lastPings";

const db = supabaseAdmin ?? supabase;

export interface TechnicianStatus {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  status: string;
  clocked_in: boolean;
  has_gps_consent: boolean;
  last_ping_at: string | null;
  is_stale: boolean | null;
  location_label: "current" | "last_known" | "unavailable";
  location: { lat: number; lng: number } | null;
  assignment: { id: string; customer_name: string; address: string } | null;
  lastUpdate: string | null;
}

/**
 * Builds the per-technician status list (clock state, assignment status,
 * consent-respecting last-known location) shared by /api/admin/tracking/
 * employees and the Operations Center dispatch map. One definition of
 * "what is a technician's current status" — not two that could drift apart.
 */
export async function getTechnicianStatusList(): Promise<TechnicianStatus[]> {
  const { data: employees, error: empErr } = await db
    .from("employees")
    .select("id, user_id, role, phone, status, gps_consent_at")
    .eq("status", "active");

  if (empErr) throw new Error(empErr.message);
  if (!employees || employees.length === 0) return [];

  const employeeIds = employees.map((e: any) => e.id);
  const userIds = employees.map((e: any) => e.user_id).filter(Boolean);
  const today = format(new Date(), "yyyy-MM-dd");

  const [profilesRes, openShiftsRes, activeAssignmentsRes, lastPingsByEmployee] = await Promise.all([
    db.from("profiles").select("id, name").in("id", userIds),
    db.from("shifts").select("employee_id").eq("shift_date", today).is("clock_out_at", null).in("employee_id", employeeIds),
    db.from("assignments")
      .select(`id, employee_id, status, en_route_at, appointment_id, appointments ( user_id, property_id, service_type )`)
      .in("employee_id", employeeIds)
      .in("status", ["en_route", "in_progress"]),
    getLastPingsByEmployee(employeeIds),
  ]);

  const profileMap: Record<string, string> = {};
  (profilesRes.data || []).forEach((p: any) => { profileMap[p.id] = p.name || "Employee"; });

  const clockedInIds = new Set((openShiftsRes.data || []).map((s: any) => s.employee_id));

  const apptUserIds = [...new Set((activeAssignmentsRes.data || []).map((a: any) => a.appointments?.user_id).filter(Boolean))];
  const apptPropIds = [...new Set((activeAssignmentsRes.data || []).map((a: any) => a.appointments?.property_id).filter(Boolean))];

  const [custProfiles, properties] = await Promise.all([
    apptUserIds.length > 0 ? db.from("profiles").select("id, name").in("id", apptUserIds) : { data: [] },
    apptPropIds.length > 0 ? db.from("properties").select("id, address").in("id", apptPropIds) : { data: [] },
  ]);

  const custMap: Record<string, string> = {};
  (custProfiles.data || []).forEach((p: any) => { custMap[p.id] = p.name || "Customer"; });
  const propMap: Record<string, string> = {};
  (properties.data || []).forEach((p: any) => { propMap[p.id] = p.address || ""; });

  const activeMap: Record<string, any> = {};
  (activeAssignmentsRes.data || []).forEach((a: any) => {
    if (!activeMap[a.employee_id]) {
      activeMap[a.employee_id] = {
        id: a.id,
        customer_name: custMap[a.appointments?.user_id] ?? "Customer",
        address: propMap[a.appointments?.property_id] ?? "",
        status: a.status,
        en_route_at: a.en_route_at,
      };
    }
  });

  return employees.map((emp: any) => {
    const active = activeMap[emp.id] ?? null;
    const clockedIn = clockedInIds.has(emp.id);
    const hasConsent = !!emp.gps_consent_at;
    const lastPing = hasConsent ? lastPingsByEmployee.get(emp.id) : null;
    const lastPingAt = lastPing?.captured_at ?? null;

    // Consent-respecting: never surface coordinates for a technician who
    // hasn't (or no longer has) consented, even if an old ping exists from
    // before consent was withdrawn.
    const location = hasConsent && lastPing
      ? { lat: Number(lastPing.latitude), lng: Number(lastPing.longitude) }
      : null;

    return {
      id: emp.id,
      name: profileMap[emp.user_id] || "Employee",
      role: emp.role,
      phone: emp.phone ?? null,
      status: active?.status || "idle",
      clocked_in: clockedIn,
      has_gps_consent: hasConsent,
      last_ping_at: lastPingAt,
      is_stale: clockedIn ? isStale(lastPingAt) : null,
      location_label: !location ? "unavailable" : (clockedIn && !isStale(lastPingAt)) ? "current" : "last_known",
      location,
      assignment: active ? { id: active.id, customer_name: active.customer_name, address: active.address } : null,
      lastUpdate: active?.en_route_at ?? null,
    };
  });
}
