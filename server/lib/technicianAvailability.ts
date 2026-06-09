import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabaseAdmin";

const db = supabaseAdmin ?? supabase;

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  work_start?: string;
  work_end?: string;
  max_stops?: number;
  warnings?: string[];
}

/**
 * Determines whether a technician is available to work on a given date.
 *
 * Resolution priority (highest → lowest):
 * 1. Employee inactive → unavailable
 * 2. Company-wide blackout date → unavailable
 * 3. Employee-scoped blackout date → unavailable
 * 4. Approved time-off request (if table exists; graceful failure) → unavailable
 * 5. Technician date override (admin-set exception for one day)
 * 6. Technician weekly schedule template
 * 7. Backward-compatible default: available (with warning if no template)
 */
export async function isTechnicianAvailable(
  techId: string,
  date: string // YYYY-MM-DD
): Promise<AvailabilityResult> {
  const warnings: string[] = [];

  // ── 1. Employee status ────────────────────────────────────────────────────
  const { data: emp } = await db
    .from("employees")
    .select("status, default_max_stops")
    .eq("id", techId)
    .maybeSingle();

  if (!emp || emp.status !== "active") {
    return { available: false, reason: "employee_inactive" };
  }

  // ── 2. Company-wide blackout ──────────────────────────────────────────────
  const { data: companyBlackout } = await db
    .from("blackout_dates")
    .select("id, reason")
    .eq("date", date)
    .eq("scope", "all")
    .maybeSingle();

  if (companyBlackout) {
    return {
      available: false,
      reason: "company_blackout",
      warnings: [`Company blackout: ${companyBlackout.reason ?? "closed"}`],
    };
  }

  // ── 3. Employee-scoped blackout ───────────────────────────────────────────
  const { data: empBlackout } = await db
    .from("blackout_dates")
    .select("id, reason")
    .eq("date", date)
    .eq("scope", "employee")
    .eq("employee_id", techId)
    .maybeSingle();

  if (empBlackout) {
    return {
      available: false,
      reason: "employee_blackout",
      warnings: [`Employee blackout: ${empBlackout.reason ?? "unavailable"}`],
    };
  }

  // ── 4. Approved time-off request (graceful — table may not exist yet) ─────
  try {
    const { data: timeOff } = await db
      .from("technician_time_off_requests")
      .select("id, request_type")
      .eq("employee_id", techId)
      .eq("status", "approved")
      .lte("start_date", date)
      .gte("end_date", date)
      .limit(1)
      .maybeSingle();

    if (timeOff) {
      return {
        available: false,
        reason: "approved_time_off",
        warnings: [`Approved time off (${timeOff.request_type})`],
      };
    }
  } catch {
    // Table doesn't exist yet — skip gracefully
  }

  // ── 5. Technician date override ───────────────────────────────────────────
  const { data: override } = await db
    .from("technician_date_overrides")
    .select("is_available, work_start, work_end, max_stops_override, reason")
    .eq("employee_id", techId)
    .eq("override_date", date)
    .maybeSingle();

  if (override) {
    if (!override.is_available) {
      return {
        available: false,
        reason: "date_override",
        warnings: [override.reason ? `Override: ${override.reason}` : "Admin marked unavailable for this date"],
      };
    }
    return {
      available: true,
      reason: "date_override",
      work_start: override.work_start ?? undefined,
      work_end: override.work_end ?? undefined,
      max_stops: override.max_stops_override ?? undefined,
    };
  }

  // ── 6. Weekly schedule template ───────────────────────────────────────────
  const dayOfWeek = new Date(date + "T00:00:00").getDay(); // 0=Sun ... 6=Sat

  const { data: template } = await db
    .from("technician_schedule_templates")
    .select("is_working, work_start, work_end, max_stops")
    .eq("employee_id", techId)
    .eq("day_of_week", dayOfWeek)
    .lte("effective_from", date)
    .or("effective_until.is.null,effective_until.gte." + date)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (template) {
    if (!template.is_working) {
      return { available: false, reason: "not_scheduled", warnings: [`Day off per schedule (day ${dayOfWeek})`] };
    }
    return {
      available: true,
      reason: "schedule_template",
      work_start: template.work_start ?? undefined,
      work_end: template.work_end ?? undefined,
      max_stops: template.max_stops ?? undefined,
    };
  }

  // ── 7. No template — backward-compatible default ─────────────────────────
  // Check business hours: if business is closed that day, treat tech as unavailable
  const { data: biz } = await db
    .from("business_hours")
    .select("is_operational")
    .eq("day_of_week", dayOfWeek)
    .is("service_area_id", null)
    .maybeSingle();

  if (biz && !biz.is_operational) {
    return {
      available: false,
      reason: "business_closed",
      warnings: ["Business is closed on this day"],
    };
  }

  warnings.push("No schedule template configured for this technician — using business-hours default");

  return {
    available: true,
    reason: "default_business_hours",
    warnings,
  };
}
