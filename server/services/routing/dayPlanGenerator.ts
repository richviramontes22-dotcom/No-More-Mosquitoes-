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

  // 7. Create draft routes + stops per technician.
  //
  // Batched, not one-row-per-appointment/technician: the original version made
  // a separate awaited Supabase call for every appointment's existing-assignment
  // check, every appointment's assignment insert, every technician's
  // existing-route check, and every technician's route insert — ~426 sequential
  // round trips for 150 appointments / 42 technicians, ~82s measured. See
  // ROUTE_GENERATION_PERFORMANCE_AUDIT.md. This computes the exact same
  // per-technician/per-appointment decisions in memory first, then does each
  // kind of read/write exactly once across the whole batch.
  const createdRoutes: any[] = [];
  const unassigned: any[] = [];

  // 7a. Capacity split per technician (in-memory, unchanged decision logic) —
  // done up front so we know the full candidate appointment/technician set
  // before issuing any of the batched queries below.
  const techIdsWithLoad = technicians.filter((t: any) => (techLoads.get(t.id) || []).length > 0);
  const perTechCapacity = new Map<string, { tech: any; withinCap: any[] }>();
  for (const tech of techIdsWithLoad) {
    const techAppts = techLoads.get(tech.id) || [];
    const techMaxStops = techCapacities[tech.id] ?? maxStopsPerTech;
    const withinCap = techAppts.slice(0, techMaxStops);
    const overflow = techAppts.slice(techMaxStops);
    if (overflow.length > 0) {
      dayConflictNotes.push(`Technician ${tech.id.slice(0, 8)}: ${overflow.length} appointment(s) over capacity (${techMaxStops} max)`);
    }
    unassigned.push(...overflow);
    perTechCapacity.set(tech.id, { tech, withinCap });
  }

  // 7b. Batch-fetch technicians that already have a draft/approved route for
  // this date — replaces one query per technician.
  const candidateTechIds = [...perTechCapacity.keys()];
  const techsWithExistingRoute = new Set<string>();
  if (candidateTechIds.length > 0) {
    const { data: existingRoutes } = await db
      .from("routes")
      .select("employee_id")
      .eq("date", date)
      .in("employee_id", candidateTechIds)
      .in("status", ["draft", "approved"]);
    (existingRoutes || []).forEach((r: any) => techsWithExistingRoute.add(r.employee_id));
  }

  // Technicians actually eligible to get a new route this run (has load,
  // doesn't already have one) — same eligibility the original `continue`
  // after the existingDraft check enforced.
  const eligiblePlans = [...perTechCapacity.values()].filter(
    (p) => !techsWithExistingRoute.has(p.tech.id) && p.withinCap.length > 0
  );

  // 7c. Batch-fetch existing assignments for every candidate appointment
  // across every eligible technician — replaces one query per appointment.
  const allCandidateApptIds = [...new Set(eligiblePlans.flatMap((p) => p.withinCap.map((a: any) => a.id)))];
  const existingAssignMap = new Map<string, { id: string }>(); // key: `${appointment_id}::${employee_id}`
  if (allCandidateApptIds.length > 0) {
    const { data: existingAssigns } = await db
      .from("assignments")
      .select("id, appointment_id, employee_id")
      .in("appointment_id", allCandidateApptIds);
    (existingAssigns || []).forEach((a: any) => {
      if (a.employee_id) existingAssignMap.set(`${a.appointment_id}::${a.employee_id}`, { id: a.id });
    });
  }

  // 7d. Insert every still-missing assignment in one multi-row insert —
  // replaces one insert per new appointment.
  const newAssignmentRows: Array<{ appointment_id: string; employee_id: string; status: string }> = [];
  for (const plan of eligiblePlans) {
    for (const appt of plan.withinCap) {
      const key = `${appt.id}::${plan.tech.id}`;
      if (!existingAssignMap.has(key)) {
        newAssignmentRows.push({ appointment_id: appt.id, employee_id: plan.tech.id, status: "scheduled" });
      }
    }
  }
  if (newAssignmentRows.length > 0) {
    const { data: insertedAssigns, error: bulkAssignErr } = await db
      .from("assignments")
      .insert(newAssignmentRows)
      .select("id, appointment_id, employee_id");
    if (!bulkAssignErr && insertedAssigns) {
      insertedAssigns.forEach((a: any) => existingAssignMap.set(`${a.appointment_id}::${a.employee_id}`, { id: a.id }));
    }
    // If the bulk insert itself fails (rare — e.g. a malformed row), none of
    // these pairs land in existingAssignMap, so the per-appointment loop
    // below correctly falls through to its existing "missing assignment ->
    // unassigned" handling for every affected appointment, same outcome as
    // the original's per-row `if (aErr)` branch, just resolved as one batch
    // instead of individually.
  }

  // 7e. Compute each eligible technician's optimized route in memory (no DB
  // calls) — unchanged optimization/confidence/distance logic, just no
  // longer interleaved with the route insert.
  interface PendingRoute {
    tech: any;
    assignments: AssignmentForRouting[];
    optimizedStops: ReturnType<typeof optimizeRoute>;
    confidence: ReturnType<typeof calculateConfidence>;
    totalDistance: number;
    totalDuration: number;
    conflictNotes: string[];
  }
  const pendingRoutes: PendingRoute[] = [];

  for (const plan of eligiblePlans) {
    const coordSources: Record<string, CoordSource> = {};
    const conflictNotes: string[] = [];
    const assignments: AssignmentForRouting[] = [];

    for (const appt of plan.withinCap) {
      const assignRow = existingAssignMap.get(`${appt.id}::${plan.tech.id}`);
      if (!assignRow) { unassigned.push(appt); continue; }

      const prop = (appt as any).properties;
      const resolved = resolveCoordinates(prop);
      coordSources[assignRow.id] = resolved.source;
      if (resolved.source === "mock_fallback") {
        conflictNotes.push(`Stop at ${prop?.address ?? assignRow.id} uses estimated coordinates.`);
      }

      assignments.push({
        id: assignRow.id,
        appointment_id: appt.id,
        employee_id: plan.tech.id,
        status: "scheduled",
        property: prop,
        geo: { latitude: resolved.latitude, longitude: resolved.longitude },
      });
    }

    if (assignments.length === 0) continue;

    const optimizedStops = optimizeRoute(assignments);
    const mockCount = Object.values(coordSources).filter((s) => s === "mock_fallback").length;
    const confidence = calculateConfidence(assignments.length, mockCount, conflictNotes);
    const totalDistance = optimizedStops.reduce((s, st) => s + st.distanceFromPrevious, 0);
    const totalDuration = optimizedStops.reduce((s, st) => s + st.durationFromPrevious, 0);

    pendingRoutes.push({ tech: plan.tech, assignments, optimizedStops, confidence, totalDistance, totalDuration, conflictNotes });
  }

  // 7f. Insert every route in one multi-row insert — replaces one insert per
  // technician. Correlated back by employee_id (unique per date among these
  // rows), not array position, so this can't silently mismatch even though
  // Postgres does preserve VALUES-list order for RETURNING in practice.
  if (pendingRoutes.length > 0) {
    const routeInsertRows = pendingRoutes.map((r) => ({
      employee_id: r.tech.id,
      date,
      status: "draft",
      created_by: actorId,
      total_distance_miles: r.totalDistance,
      total_duration_minutes: r.totalDuration,
      algorithm_version: "nearest-neighbor-v1",
      confidence: r.confidence,
      conflict_notes: r.conflictNotes.length > 0 ? r.conflictNotes : null,
    }));

    const { data: insertedRoutes, error: routeInsertErr } = await db
      .from("routes")
      .insert(routeInsertRows)
      .select("*");

    if (routeInsertErr || !insertedRoutes) {
      // Whole batch failed — same fallback the original took per-technician
      // on a route insert error: every appointment that would have been on
      // one of these routes goes to unassigned instead.
      for (const r of pendingRoutes) unassigned.push(...r.assignments.map((a) => ({ id: a.appointment_id })));
    } else {
      const routeByEmployeeId = new Map(insertedRoutes.map((r: any) => [r.employee_id, r]));
      const allStopRows: any[] = [];
      const auditLogRows: any[] = [];

      for (const r of pendingRoutes) {
        const routeData = routeByEmployeeId.get(r.tech.id);
        if (!routeData) { unassigned.push(...r.assignments.map((a) => ({ id: a.appointment_id }))); continue; }

        allStopRows.push(...r.optimizedStops.map((stop) => ({
          route_id: routeData.id,
          assignment_id: stop.assignment.id,
          appointment_id: stop.assignment.appointment_id,
          sequence_number: stop.sequenceNumber,
          distance_from_prev_miles: stop.distanceFromPrevious,
          duration_from_prev_minutes: stop.durationFromPrevious,
          arrival_eta: stop.arrivalEta,
          departure_eta: stop.departureEta,
          status: "pending",
        })));

        auditLogRows.push({
          route_id: routeData.id,
          actor_id: actorId,
          actor_role: actorRole,
          action: actorRole === "system" ? "automation_route_generated" : "route_generated",
          metadata: { employee_id: r.tech.id, stop_count: r.optimizedStops.length, confidence: r.confidence, day_plan: true },
        });

        checkpoint(reqId, CP.ROUTE_CREATED, { routeId: routeData.id, employeeId: r.tech.id, stopCount: r.optimizedStops.length, confidence: r.confidence });
        createdRoutes.push({ ...routeData, stop_count: r.optimizedStops.length, coordinate_warnings: r.conflictNotes });
      }

      // 7g. One bulk insert for every route's stops, and one for every
      // route's audit log entry — replaces one of each per technician.
      if (allStopRows.length > 0) await db.from("route_stops").insert(allStopRows);
      if (auditLogRows.length > 0) void db.from("route_audit_log").insert(auditLogRows);
    }
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
