import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabaseAdmin";
import { isTechnicianAvailable } from "./technicianAvailability";

const db = supabaseAdmin ?? supabase;

export interface ValidationWarning {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  entity_id?: string;
}

export interface ValidationResult {
  valid: boolean;
  severity: "info" | "warning" | "critical" | "ok";
  warnings: ValidationWarning[];
  blockers: ValidationWarning[];
}

/**
 * Validates a single route against workforce constraints.
 * Returns blockers (critical) and warnings (non-blocking).
 */
export async function validateRouteForWorkforce(routeId: string): Promise<ValidationResult> {
  const warnings: ValidationWarning[] = [];
  const blockers: ValidationWarning[] = [];

  const { data: route } = await db
    .from("routes")
    .select("id, employee_id, date, status, confidence, conflict_notes, total_distance_miles")
    .eq("id", routeId)
    .maybeSingle();

  if (!route) {
    return { valid: false, severity: "critical", warnings: [], blockers: [{ code: "route_not_found", severity: "critical", message: "Route not found" }] };
  }

  const date = (route as any).date as string;
  const techId = (route as any).employee_id as string;

  // Check technician availability
  const avail = await isTechnicianAvailable(techId, date);
  if (!avail.available) {
    blockers.push({
      code: "technician_unavailable",
      severity: "critical",
      message: `Technician is unavailable on ${date}: ${avail.reason}`,
      entity_id: techId,
    });
  }

  // Check for missing schedule template
  const { data: schedTemplate } = await db
    .from("technician_schedule_templates")
    .select("id")
    .eq("employee_id", techId)
    .limit(1)
    .maybeSingle();

  if (!schedTemplate) {
    warnings.push({
      code: "missing_schedule_template",
      severity: "warning",
      message: "Technician has no schedule template configured",
      entity_id: techId,
    });
  }

  // Check for missing capacity profile
  const { data: capProfile } = await db
    .from("technician_capacity_profiles")
    .select("id, max_stops_per_day")
    .eq("employee_id", techId)
    .maybeSingle();

  if (!capProfile) {
    warnings.push({
      code: "missing_capacity_profile",
      severity: "warning",
      message: "Technician has no capacity profile configured — using defaults",
      entity_id: techId,
    });
  }

  // Check stop count vs capacity
  const { count: stopCount } = await db
    .from("route_stops")
    .select("id", { count: "exact" })
    .eq("route_id", routeId);

  const maxStops = capProfile?.max_stops_per_day ?? 8;
  if ((stopCount ?? 0) > maxStops) {
    blockers.push({
      code: "capacity_exceeded",
      severity: "critical",
      message: `Route has ${stopCount} stops but technician capacity is ${maxStops}`,
      entity_id: routeId,
    });
  }

  // Route quality warnings
  if ((route as any).confidence === "low") {
    warnings.push({
      code: "low_confidence",
      severity: "warning",
      message: "Route has low confidence — many stops use estimated coordinates",
      entity_id: routeId,
    });
  }

  const conflictNotes: string[] = (route as any).conflict_notes ?? [];
  if (conflictNotes.length > 0) {
    warnings.push({
      code: "coordinate_warnings",
      severity: "info",
      message: `${conflictNotes.length} coordinate warning(s): ${conflictNotes[0]}${conflictNotes.length > 1 ? ` (+${conflictNotes.length - 1} more)` : ""}`,
      entity_id: routeId,
    });
  }

  const allIssues = [...blockers, ...warnings];
  const severity = blockers.length > 0 ? "critical" : warnings.length > 0 ? "warning" : "ok";

  return {
    valid: blockers.length === 0,
    severity,
    warnings,
    blockers,
  };
}

/**
 * Validates all routes for a date against workforce constraints.
 * Used before bulk publish to catch problems.
 */
export async function validateDayPlanForWorkforce(date: string): Promise<{
  date: string;
  overall_valid: boolean;
  overall_severity: "ok" | "warning" | "critical";
  routes: Array<{ route_id: string; employee_id: string; result: ValidationResult }>;
  unassigned_count: number;
}> {
  const { data: routes } = await db
    .from("routes")
    .select("id, employee_id, status")
    .eq("date", date)
    .in("status", ["draft", "approved"]);

  // Count unassigned appointments for the date
  const { data: appts } = await db
    .from("appointments")
    .select("id")
    .gte("scheduled_at", `${date}T00:00:00Z`)
    .lt("scheduled_at", `${date}T23:59:59Z`)
    .eq("status", "scheduled");

  const apptIds = (appts || []).map((a: any) => a.id);
  let routedCount = 0;
  if (apptIds.length > 0) {
    const { count } = await db
      .from("route_stops")
      .select("id", { count: "exact" })
      .in("appointment_id", apptIds);
    routedCount = count ?? 0;
  }
  const unassignedCount = apptIds.length - routedCount;

  const routeResults = await Promise.all(
    (routes || []).map(async (r: any) => ({
      route_id: r.id,
      employee_id: r.employee_id,
      result: await validateRouteForWorkforce(r.id),
    }))
  );

  const hasBlockers = routeResults.some((r) => r.result.blockers.length > 0);
  const hasWarnings = routeResults.some((r) => r.result.warnings.length > 0) || unassignedCount > 0;
  const overallSeverity = hasBlockers ? "critical" : hasWarnings ? "warning" : "ok";

  return {
    date,
    overall_valid: !hasBlockers,
    overall_severity: overallSeverity,
    routes: routeResults,
    unassigned_count: unassignedCount,
  };
}
