import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  optimizeRoute, type AssignmentForRouting,
  resolveCoordinates, calculateConfidence, type CoordSource,
} from "../../lib/routeOptimization";
import { isTechnicianAvailable } from "../../lib/technicianAvailability";
import { getEffectiveDailyCapacity } from "../../lib/technicianCapacity";
import { logger } from "../../lib/logger";
import { checkpoint, CP } from "../../lib/checkpoint";

const db = supabaseAdmin ?? supabase;

function logRouteAudit(
  routeId: string,
  actorId: string | null,
  actorRole: string,
  action: string,
  metadata?: Record<string, any>
) {
  void db.from("route_audit_log").insert({
    route_id: routeId,
    actor_id: actorId,
    actor_role: actorRole,
    action,
    metadata: metadata ?? null,
  });
}

export interface GenerateDayPlanOptions {
  maxStopsPerTech?: number;
  /** Admin user id for manual calls, or null for system-triggered (automation) calls. */
  actorId: string | null;
  /** "admin" for manual calls, "system" for automation-triggered calls — recorded in route_audit_log. */
  actorRole: "admin" | "system";
}

export interface GenerateDayPlanResult {
  success: boolean;
  blocked_reason?: "company_blackout" | "no_technicians_available";
  date: string;
  routes: any[];
  unassigned_appointments: any[];
  workforce_notes: string[];
  excluded_technicians: number;
  message: string;
}

/**
 * Generates draft routes for every available technician on a given date,
 * grouping unrouted appointments by ZIP and assigning round-robin by load.
 *
 * This is the exact logic previously inlined in
 * POST /api/admin/routes/day/generate — extracted here, unchanged, so it can
 * also be called from the Platform Growth Phase 2 auto-generate sweep
 * (server/services/routing/routeAutomationPolicy.ts) without duplicating it.
 * The route handler is now a thin wrapper around this function.
 */
export async function generateDayPlan(
  date: string,
  options: GenerateDayPlanOptions,
): Promise<GenerateDayPlanResult> {
  const { maxStopsPerTech = 8, actorId, actorRole } = options;
  const reqId = actorId || `${actorRole}-${date}`;
  const genStart = Date.now();

  checkpoint(reqId, CP.ROUTE_DAY_GENERATE_START, { date, max_stops_per_tech: maxStopsPerTech, actorRole });
  logger.info("route.day_generate.started", { requestId: reqId, date, actorRole });

  // 0. Company-wide blackout check — reject entire day if blacked out
  const { data: companyBlackout } = await db
    .from("blackout_dates")
    .select("id, reason")
    .eq("date", date)
    .eq("scope", "all")
    .maybeSingle();

  if (companyBlackout) {
    checkpoint(reqId, CP.ROUTE_BLACKOUT_CHECKED, { blocked: true, reason: (companyBlackout as any).reason });
    logger.warn("route.day_generate.blackout_blocked", { requestId: reqId, date, reason: (companyBlackout as any).reason });
    return {
      success: false,
      blocked_reason: "company_blackout",
      date,
      routes: [],
      unassigned_appointments: [],
      workforce_notes: [],
      excluded_technicians: 0,
      message: `Cannot generate routes — this date is a company blackout: ${(companyBlackout as any).reason ?? "closed"}`,
    };
  }
  checkpoint(reqId, CP.ROUTE_BLACKOUT_CHECKED, { blocked: false });

  // 1. Get all active technicians
  const { data: techs } = await db
    .from("employees")
    .select("id, user_id")
    .eq("status", "active")
    .in("role", ["technician", "dispatcher"]);
  const allTechnicians = techs || [];

  // 2. Filter to available technicians using workforce availability check
  const dayConflictNotes: string[] = [];
  const unavailableTechIds = new Set<string>();
  const techCapacities: Record<string, number> = {};

  await Promise.all(allTechnicians.map(async (tech: any) => {
    const avail = await isTechnicianAvailable(tech.id, date);
    if (!avail.available) {
      unavailableTechIds.add(tech.id);
      dayConflictNotes.push(`Technician ${tech.id.slice(0, 8)}: excluded (${avail.reason})`);
    } else {
      const cap = await getEffectiveDailyCapacity(tech.id, date);
      techCapacities[tech.id] = cap.max_stops;
      if (avail.warnings?.length) {
        dayConflictNotes.push(...avail.warnings.map((w: string) => `${tech.id.slice(0, 8)}: ${w}`));
      }
    }
  }));

  const technicians = allTechnicians.filter((t: any) => !unavailableTechIds.has(t.id));
  checkpoint(reqId, CP.ROUTE_TECHS_FILTERED, { total: allTechnicians.length, available: technicians.length, excluded: unavailableTechIds.size });
  logger.info("route.day_generate.technicians_filtered", { requestId: reqId, date, available: technicians.length, excluded: unavailableTechIds.size });

  if (technicians.length === 0) {
    void (async () => {
      try {
        const { notifyAdmin } = await import("../notifications/adminNotificationService");
        notifyAdmin({
          event_type: "workforce.no_technicians_available",
          severity: "critical",
          title: `No technicians available for ${date}`,
          body: `All active technicians are unavailable on ${date}. Routes cannot be generated.`,
          metadata: { date, excluded_count: allTechnicians.length },
        });
      } catch {}
    })();
    return {
      success: true,
      blocked_reason: "no_technicians_available",
      date,
      routes: [],
      unassigned_appointments: [],
      workforce_notes: dayConflictNotes,
      excluded_technicians: allTechnicians.length,
      message: "No technicians available for this date — all active technicians are unavailable or on time off",
    };
  }

  // 2. Find all scheduled appointments for the date
  const { data: appts } = await db
    .from("appointments")
    .select(`
      id, scheduled_at, service_type, property_id, user_id,
      properties!inner ( id, address, city, zip, lat, lng )
    `)
    .gte("scheduled_at", `${date}T00:00:00Z`)
    .lt("scheduled_at", `${date}T23:59:59Z`)
    .eq("status", "scheduled");

  const allAppts = appts || [];

  // 3. Find which appointments already have assignments on approved/published routes
  const apptIds = allAppts.map((a: any) => a.id);
  let routedApptIds = new Set<string>();

  if (apptIds.length > 0) {
    const { data: routed } = await db
      .from("route_stops")
      .select("appointment_id, routes!inner(status)")
      .in("appointment_id", apptIds)
      .in("routes.status", ["approved", "published", "in_progress"]);

    (routed || []).forEach((rs: any) => {
      if (rs.appointment_id) routedApptIds.add(rs.appointment_id);
    });
  }

  // 4. Filter to unrouted appointments
  const unrouted = allAppts.filter((a: any) => !routedApptIds.has(a.id));

  if (unrouted.length === 0) {
    return {
      success: true,
      date,
      routes: [],
      unassigned_appointments: [],
      workforce_notes: dayConflictNotes,
      excluded_technicians: unavailableTechIds.size,
      message: "All appointments are already on approved routes",
    };
  }

  // 5. Group by ZIP code
  const byZip: Record<string, any[]> = {};
  for (const appt of unrouted) {
    const zip = (appt as any).properties?.zip ?? "00000";
    if (!byZip[zip]) byZip[zip] = [];
    byZip[zip].push(appt);
  }

  // 6. Sort ZIP groups by size (descending) then assign round-robin to technicians
  const zipGroups = Object.values(byZip).sort((a, b) => b.length - a.length);
  const techLoads: Map<string, any[]> = new Map(technicians.map((t: any) => [t.id, []]));
  const techQueue = [...technicians.map((t: any) => t.id)];

  for (const group of zipGroups) {
    let minLoad = Infinity;
    let minTechId = techQueue[0];
    for (const tid of techQueue) {
      const load = techLoads.get(tid)?.length ?? 0;
      if (load < minLoad) { minLoad = load; minTechId = tid; }
    }
    techLoads.get(minTechId)!.push(...group);
  }

  // 7. Create draft routes + stops per technician
  const createdRoutes: any[] = [];
  const unassigned: any[] = [];

  for (const tech of technicians) {
    const techAppts = techLoads.get(tech.id) || [];
    if (techAppts.length === 0) continue;

    const techMaxStops = techCapacities[tech.id] ?? maxStopsPerTech;
    const withinCap = techAppts.slice(0, techMaxStops);
    const overflow = techAppts.slice(techMaxStops);
    if (overflow.length > 0) {
      dayConflictNotes.push(`Technician ${tech.id.slice(0, 8)}: ${overflow.length} appointment(s) over capacity (${techMaxStops} max)`);
    }
    unassigned.push(...overflow);

    const { data: existingDraft } = await db
      .from("routes")
      .select("id, status")
      .eq("employee_id", tech.id)
      .eq("date", date)
      .in("status", ["draft", "approved"])
      .limit(1)
      .maybeSingle();

    if (existingDraft) continue; // already has a draft or approved route

    const coordSources: Record<string, CoordSource> = {};
    const conflictNotes: string[] = [];
    const assignments: AssignmentForRouting[] = [];

    for (const appt of withinCap) {
      let { data: existingAssign } = await db
        .from("assignments")
        .select("id, status")
        .eq("appointment_id", appt.id)
        .eq("employee_id", tech.id)
        .maybeSingle();

      let assignId: string;
      if (existingAssign) {
        assignId = existingAssign.id;
      } else {
        const { data: newAssign, error: aErr } = await db
          .from("assignments")
          .insert({ appointment_id: appt.id, employee_id: tech.id, status: "scheduled" })
          .select("id")
          .single();
        if (aErr) { unassigned.push(appt); continue; }
        assignId = newAssign.id;
      }

      const prop = (appt as any).properties;
      const resolved = resolveCoordinates(prop);
      coordSources[assignId] = resolved.source;
      if (resolved.source === "mock_fallback") {
        conflictNotes.push(`Stop at ${prop?.address ?? assignId} uses estimated coordinates.`);
      }

      assignments.push({
        id: assignId,
        appointment_id: appt.id,
        employee_id: tech.id,
        status: "scheduled",
        property: prop,
        geo: { latitude: resolved.latitude, longitude: resolved.longitude },
      });
    }

    if (assignments.length === 0) continue;

    const optimizedStops = optimizeRoute(assignments);
    const mockCount = Object.values(coordSources).filter(s => s === "mock_fallback").length;
    const confidence = calculateConfidence(assignments.length, mockCount, conflictNotes);
    const totalDistance = optimizedStops.reduce((s, st) => s + st.distanceFromPrevious, 0);
    const totalDuration = optimizedStops.reduce((s, st) => s + st.durationFromPrevious, 0);

    const { data: routeData, error: routeErr } = await db
      .from("routes")
      .insert({
        employee_id: tech.id,
        date,
        status: "draft",
        created_by: actorId,
        total_distance_miles: totalDistance,
        total_duration_minutes: totalDuration,
        algorithm_version: "nearest-neighbor-v1",
        confidence,
        conflict_notes: conflictNotes.length > 0 ? conflictNotes : null,
      })
      .select("*")
      .single();

    if (routeErr) { unassigned.push(...withinCap); continue; }

    const stopsToCreate = optimizedStops.map((stop) => ({
      route_id: routeData.id,
      assignment_id: stop.assignment.id,
      appointment_id: stop.assignment.appointment_id,
      sequence_number: stop.sequenceNumber,
      distance_from_prev_miles: stop.distanceFromPrevious,
      duration_from_prev_minutes: stop.durationFromPrevious,
      arrival_eta: stop.arrivalEta,
      departure_eta: stop.departureEta,
      status: "pending",
    }));

    await db.from("route_stops").insert(stopsToCreate);

    logRouteAudit(routeData.id, actorId, actorRole, actorRole === "system" ? "automation_route_generated" : "route_generated", {
      employee_id: tech.id,
      stop_count: optimizedStops.length,
      confidence,
      day_plan: true,
    });

    checkpoint(reqId, CP.ROUTE_CREATED, { routeId: routeData.id, employeeId: tech.id, stopCount: optimizedStops.length, confidence });
    createdRoutes.push({ ...routeData, stop_count: optimizedStops.length, coordinate_warnings: conflictNotes });
  }

  const durationMs = Date.now() - genStart;
  logger.info("route.day_generate.created", { requestId: reqId, date, routeCount: createdRoutes.length, unassigned: unassigned.length, excluded: unavailableTechIds.size, durationMs });

  return {
    success: true,
    date,
    routes: createdRoutes,
    unassigned_appointments: unassigned,
    workforce_notes: dayConflictNotes,
    excluded_technicians: unavailableTechIds.size,
    message: `Created ${createdRoutes.length} draft route(s). ${unassigned.length} appointment(s) unassigned. ${unavailableTechIds.size} technician(s) excluded due to availability.`,
  };
}
