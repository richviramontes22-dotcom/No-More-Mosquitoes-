import express from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import {
  optimizeRoute, type AssignmentForRouting,
  resolveCoordinates, calculateConfidence, type CoordSource,
} from "../lib/routeOptimization";
import { smartOptimizeRoute, type SmartStop } from "../services/routing/smartRoutingOptimizer";
import {
  getRouteAutomationSettings,
  updateRouteAutomationSettings,
  autoPublishEligibleRoutes,
  autoGenerateAndOptimizeDayPlans,
} from "../services/routing/routeAutomationPolicy";
import { generateDayPlan } from "../services/routing/dayPlanGenerator";
import { isTechnicianAvailable } from "../lib/technicianAvailability";
import { getEffectiveDailyCapacity } from "../lib/technicianCapacity";
import { flags } from "../lib/featureFlags";
import { logger } from "../lib/logger";
import { checkpoint, CP } from "../lib/checkpoint";

const db = supabaseAdmin ?? supabase;
const router = express.Router();

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getAdminUserId(req: any): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !user) return null;
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return null;
  return user.id;
}

async function getAdminOrEmployeeUserId(req: any): Promise<{ userId: string; role: string } | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabase.auth.getUser(header.slice(7));
  if (error || !user) return null;
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "employee"].includes(profile.role)) return null;
  return { userId: user.id, role: profile.role };
}

// ─── Route audit log ─────────────────────────────────────────────────────────

function logRouteAudit(
  routeId: string,
  actorId: string,
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

// ─── Coordinate resolution ────────────────────────────────────────────────────
// resolveCoordinates / mockGeocodeAddress / calculateConfidence / CoordSource
// moved to ../lib/routeOptimization.ts so server/services/routing/dayPlanGenerator.ts
// (Platform Growth Phase 2 — auto-generate) can share the exact same implementation.

// ─── Shared: build enriched stops for a set of assignments ───────────────────

async function buildAssignmentsForDate(employeeId: string, date: string): Promise<{
  assignments: AssignmentForRouting[];
  coordSources: Record<string, CoordSource>;
  conflictNotes: string[];
}> {
  const { data, error } = await db
    .from("assignments")
    .select(`
      id,
      appointment_id,
      employee_id,
      status,
      started_at,
      completed_at,
      appointments!inner (
        id,
        scheduled_at,
        service_type,
        property_id,
        properties!inner (
          id,
          address,
          city,
          state,
          zip,
          lat,
          lng
        )
      )
    `)
    .eq("employee_id", employeeId)
    .gte("appointments.scheduled_at", `${date}T00:00:00Z`)
    .lt("appointments.scheduled_at", `${date}T23:59:59Z`);

  if (error) throw error;

  const coordSources: Record<string, CoordSource> = {};
  const conflictNotes: string[] = [];

  const assignments: AssignmentForRouting[] = (data || []).map((a: any) => {
    const prop = a.appointments?.properties;
    const resolved = resolveCoordinates(prop);
    coordSources[a.id] = resolved.source;
    if (resolved.source === "mock_fallback") {
      conflictNotes.push(`Stop at ${prop?.address ?? a.id} uses estimated coordinates — GPS data missing.`);
    }
    return {
      id: a.id,
      appointment_id: a.appointment_id,
      employee_id: a.employee_id,
      status: a.status,
      property: a.appointments?.properties,
      geo: { latitude: resolved.latitude, longitude: resolved.longitude },
      started_at: a.started_at,
      completed_at: a.completed_at,
    };
  });

  return { assignments, coordSources, conflictNotes };
}

// ─── GET /api/admin/routes ────────────────────────────────────────────────────

router.get("/routes", async (req, res) => {
  const actor = await getAdminOrEmployeeUserId(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { employee_id, date } = req.query as Record<string, string>;
  if (!employee_id || !date) return res.status(400).json({ error: "employee_id and date required" });

  const { data: routes, error } = await db
    .from("routes")
    .select(`
      id, employee_id, date, status, confidence, conflict_notes,
      total_distance_miles, total_duration_minutes,
      created_at, approved_at, published_at,
      route_stops (
        id, sequence_number, assignment_id, arrival_eta, departure_eta,
        status, distance_from_prev_miles, duration_from_prev_minutes, notes
      )
    `)
    .eq("employee_id", employee_id)
    .eq("date", date)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const transformed = (routes || []).map((r: any) => ({
    ...r,
    stops: (r.route_stops || []).map((s: any) => ({
      id: s.id,
      sequence_number: s.sequence_number,
      assignment_id: s.assignment_id,
      arrival_eta: s.arrival_eta,
      departure_eta: s.departure_eta,
      status: s.status,
      distance_from_prev_miles: s.distance_from_prev_miles,
      duration_from_prev_minutes: s.duration_from_prev_minutes,
      notes: s.notes,
    })),
  }));

  res.json({ routes: transformed });
});

// ─── GET /api/admin/routes/:routeId ──────────────────────────────────────────

router.get("/routes/:routeId", async (req, res) => {
  const actor = await getAdminOrEmployeeUserId(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { data: route, error: rErr } = await db
    .from("routes")
    .select("*")
    .eq("id", req.params.routeId)
    .single();
  if (rErr || !route) return res.status(404).json({ error: "Route not found" });

  const { data: stops, error: sErr } = await db
    .from("route_stops")
    .select(`
      *,
      assignments!inner (
        id, appointment_id,
        appointments!inner (
          id, scheduled_at, service_type,
          properties!inner ( id, address, city, state, zip, lat, lng )
        )
      )
    `)
    .eq("route_id", req.params.routeId)
    .order("sequence_number");

  if (sErr) return res.status(500).json({ error: sErr.message });
  res.json({ route, stops: stops || [] });
});

// ─── POST /api/admin/routes/generate (single technician) ─────────────────────

router.post("/routes/generate", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { employee_id, date } = req.body;
  if (!employee_id || !date) return res.status(400).json({ error: "employee_id and date required" });

  try {
    // Workforce: check technician availability (can be overridden with force:true)
    const { force } = req.body;
    const avail = await isTechnicianAvailable(employee_id, date);
    if (!avail.available && !force) {
      return res.status(400).json({
        error: `Technician is not available on ${date}`,
        reason: avail.reason,
        warnings: avail.warnings,
        hint: "Pass { force: true } to override this check (will be logged)",
      });
    }
    if (!avail.available && force) {
      logRouteAudit("forced-generate", adminId, "admin", "route_forced_override", {
        employee_id, date, reason: avail.reason, force: true,
      });
    }

    const { assignments, coordSources, conflictNotes } = await buildAssignmentsForDate(employee_id, date);

    if (assignments.length === 0) {
      return res.json({ success: true, message: "No assignments found for this employee on this date", route: null, stops: [] });
    }

    // Add availability warnings to conflict notes
    if (avail.warnings?.length) conflictNotes.push(...avail.warnings);
    if (!avail.available && force) conflictNotes.push("⚠ Route generated with forced availability override.");

    const cap = await getEffectiveDailyCapacity(employee_id, date);
    const optimizedStops = optimizeRoute(assignments.slice(0, cap.max_stops));
    if (assignments.length > cap.max_stops) {
      conflictNotes.push(`${assignments.length - cap.max_stops} assignment(s) over capacity limit (${cap.max_stops}) — excluded.`);
    }
    const mockCount = Object.values(coordSources).filter(s => s === "mock_fallback").length;
    const confidence = calculateConfidence(optimizedStops.length, mockCount, conflictNotes);

    const totalDistance = optimizedStops.reduce((s, st) => s + st.distanceFromPrevious, 0);
    const totalDuration = optimizedStops.reduce((s, st) => s + st.durationFromPrevious, 0);

    const { data: routeData, error: routeErr } = await db
      .from("routes")
      .insert({
        employee_id,
        date,
        status: "draft",
        created_by: adminId,
        total_distance_miles: totalDistance,
        total_duration_minutes: totalDuration,
        algorithm_version: "nearest-neighbor-v1",
        confidence,
        conflict_notes: conflictNotes.length > 0 ? conflictNotes : null,
      })
      .select("*")
      .single();

    if (routeErr) return res.status(500).json({ error: routeErr.message });

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

    const { data: stopsData, error: stopsErr } = await db
      .from("route_stops")
      .insert(stopsToCreate)
      .select("*");

    if (stopsErr) {
      await db.from("routes").delete().eq("id", routeData.id);
      return res.status(500).json({ error: stopsErr.message });
    }

    logRouteAudit(routeData.id, adminId, "admin", "route_generated", {
      employee_id,
      stop_count: optimizedStops.length,
      confidence,
      mock_coord_count: mockCount,
    });

    res.json({
      success: true,
      route: { ...routeData, coordinate_warnings: conflictNotes },
      stops: optimizedStops.map((stop, i) => ({
        ...stop,
        id: stopsData?.[i]?.id,
        coordinate_source: coordSources[stop.assignment.id],
      })),
    });
  } catch (err: any) {
    logger.error("route.generate.failed", err, { requestId: adminId });
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/routes/day/generate (multi-technician) ──────────────────

router.post("/routes/day/generate", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { date, max_stops_per_tech = 8 } = req.body;
  if (!date) return res.status(400).json({ error: "date required" });

  try {
    const result = await generateDayPlan(date, { maxStopsPerTech: max_stops_per_tech, actorId: adminId, actorRole: "admin" });

    if (result.blocked_reason === "company_blackout") {
      return res.status(400).json({ error: result.message, reason: result.blocked_reason });
    }

    res.json(result);
  } catch (err: any) {
    logger.error("route.day_generate.failed", err, { date });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/routes/day ────────────────────────────────────────────────

router.get("/routes/day", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { date } = req.query as Record<string, string>;
  if (!date) return res.status(400).json({ error: "date required" });

  const { data: routes, error } = await db
    .from("routes")
    .select(`
      id, employee_id, date, status, confidence, conflict_notes,
      total_distance_miles, total_duration_minutes,
      created_at, approved_at, published_at,
      route_stops ( id, sequence_number, status )
    `)
    .eq("date", date)
    .order("employee_id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Enrich with employee names
  const empIds = [...new Set((routes || []).map((r: any) => r.employee_id).filter(Boolean))];
  const profileMap: Record<string, { name: string; email: string }> = {};
  if (empIds.length > 0) {
    const { data: emps } = await db.from("employees").select("id, user_id").in("id", empIds);
    const userIds = (emps || []).map((e: any) => e.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const { data: profiles } = await db.from("profiles").select("id, name, email").in("id", userIds);
      const uIdToProfile: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { uIdToProfile[p.id] = p; });
      (emps || []).forEach((e: any) => {
        if (e.user_id) profileMap[e.id] = uIdToProfile[e.user_id] ?? { name: "Employee", email: "" };
      });
    }
  }

  const enriched = (routes || []).map((r: any) => ({
    ...r,
    employee_name: profileMap[r.employee_id]?.name ?? "Employee",
    employee_email: profileMap[r.employee_id]?.email ?? "",
    stop_count: (r.route_stops || []).length,
    completed_count: (r.route_stops || []).filter((s: any) => s.status === "completed").length,
  }));

  res.json({ date, routes: enriched });
});

// ─── POST /api/admin/routes/day/approve ──────────────────────────────────────

router.post("/routes/day/approve", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { date } = req.body;
  if (!date) return res.status(400).json({ error: "date required" });

  const now = new Date().toISOString();
  const { data: draftRoutes } = await db
    .from("routes")
    .select("id")
    .eq("date", date)
    .eq("status", "draft");

  const routeIds = (draftRoutes || []).map((r: any) => r.id);
  if (routeIds.length === 0) return res.json({ success: true, approved: 0, message: "No draft routes found" });

  const { error } = await db
    .from("routes")
    .update({ status: "approved", approved_at: now, approved_by: adminId })
    .in("id", routeIds);

  if (error) return res.status(500).json({ error: error.message });

  routeIds.forEach((id) => logRouteAudit(id, adminId, "admin", "route_approved", { bulk: true, date }));

  res.json({ success: true, approved: routeIds.length, message: `${routeIds.length} route(s) approved.` });
});

// ─── POST /api/admin/routes/day/publish ──────────────────────────────────────

router.post("/routes/day/publish", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { date, force } = req.body;
  if (!date) return res.status(400).json({ error: "date required" });

  const reqId = (req as any).requestId || "no-req-id";

  // Workforce validation before publish — gated by feature flag
  if (!force && flags.workforceValidation() && flags.routePublishGate()) {
    checkpoint(reqId, CP.ROUTE_PUBLISH_VALIDATION_START, { date });
    const { validateDayPlanForWorkforce } = await import("../lib/workforceValidation");
    const validation = await validateDayPlanForWorkforce(date);
    if (!validation.overall_valid) {
      checkpoint(reqId, CP.ROUTE_PUBLISH_BLOCKED, { date, blockers: validation.routes.flatMap(r => r.result.blockers.length) });
      logger.warn("route.publish.blocked_by_validation", { requestId: reqId, date, severity: validation.overall_severity });
      return res.status(400).json({
        ok: false,
        requestId: reqId,
        checkpoint: CP.ROUTE_PUBLISH_BLOCKED,
        error: "Workforce validation failed — cannot publish",
        validation,
        hint: "Fix the blockers above, or pass { force: true } to override (will be logged)",
      });
    }
    // Warnings are logged but don't block publish
    if (validation.overall_severity === "warning") {
      logRouteAudit("day-" + date, adminId, "admin", "day_published_with_warnings", {
        date, warnings: validation.routes.flatMap(r => r.result.warnings.map(w => w.message)),
      });
    }
  } else {
    logRouteAudit("day-" + date, adminId, "admin", "day_published_force_override", { date, force: true });
  }

  const now = new Date().toISOString();
  const { data: approvedRoutes } = await db
    .from("routes")
    .select("id, employee_id, confidence, conflict_notes")
    .eq("date", date)
    .in("status", ["approved", "draft"]);

  const routes = approvedRoutes || [];
  if (routes.length === 0) return res.json({ success: true, published: 0, message: "No routes to publish" });

  const routeIds = routes.map((r: any) => r.id);
  const { error } = await db
    .from("routes")
    .update({ status: "published", published_at: now, locked_at: now })
    .in("id", routeIds);

  if (error) return res.status(500).json({ error: error.message });

  routes.forEach((r: any) => logRouteAudit(r.id, adminId, "admin", "route_published", {
    bulk: true,
    date,
    confidence: r.confidence ?? null,
    conflict_notes_count: (r.conflict_notes ?? []).length,
    forced: !!force,
  }));

  // Admin alert for bulk publish
  void (async () => {
    try {
      const { notifyAdmin } = await import("../services/notifications/adminNotificationService");
      notifyAdmin({
        event_type: "scheduling.route_published",
        severity: "info",
        title: `Day routes published — ${routes.length} technician(s) for ${date}`,
        entity_type: "route",
        metadata: { date, route_count: routes.length, bulk: true },
      });
    } catch {}
  })();

  res.json({ success: true, published: routes.length, message: `${routes.length} route(s) published.` });
});

// ─── GET /api/admin/routes/day/unassigned ────────────────────────────────────

router.get("/routes/day/unassigned", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { date } = req.query as Record<string, string>;
  if (!date) return res.status(400).json({ error: "date required" });

  // Get all scheduled appointments for the date
  const { data: appts } = await db
    .from("appointments")
    .select("id, scheduled_at, service_type, property_id, properties!inner(address, city, zip)")
    .gte("scheduled_at", `${date}T00:00:00Z`)
    .lt("scheduled_at", `${date}T23:59:59Z`)
    .eq("status", "scheduled");

  const apptIds = (appts || []).map((a: any) => a.id);
  let routedIds = new Set<string>();

  if (apptIds.length > 0) {
    const { data: routed } = await db
      .from("route_stops")
      .select("appointment_id, routes!inner(status)")
      .in("appointment_id", apptIds)
      .in("routes.status", ["draft", "approved", "published", "in_progress"]);
    (routed || []).forEach((rs: any) => { if (rs.appointment_id) routedIds.add(rs.appointment_id); });
  }

  const unassigned = (appts || []).filter((a: any) => !routedIds.has(a.id));
  res.json({ date, unassigned, total: unassigned.length });
});

// ─── POST /api/admin/routes/day/rebuild ──────────────────────────────────────

router.post("/routes/day/rebuild", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { date } = req.body;
  if (!date) return res.status(400).json({ error: "date required" });

  // Delete all draft routes for the date (not published/in_progress)
  const { data: drafts } = await db
    .from("routes")
    .select("id")
    .eq("date", date)
    .in("status", ["draft", "approved"]);

  const ids = (drafts || []).map((r: any) => r.id);
  if (ids.length > 0) {
    await db.from("route_stops").delete().in("route_id", ids);
    await db.from("routes").delete().in("id", ids);
    ids.forEach((id) => logRouteAudit(id, adminId, "admin", "route_discarded", { bulk: true, date }));
  }

  res.json({ success: true, discarded: ids.length, message: `${ids.length} draft route(s) discarded. Generate again.` });
});

// ─── POST /api/admin/routes/:routeId/approve ─────────────────────────────────

router.post("/routes/:routeId/approve", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const now = new Date().toISOString();
  const { data: route, error } = await db
    .from("routes")
    .update({ status: "approved", approved_at: now, approved_by: adminId })
    .eq("id", req.params.routeId)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  logRouteAudit(req.params.routeId, adminId, "admin", "route_approved");
  res.json({ success: true, route });
});

// ─── POST /api/admin/routes/:routeId/publish ─────────────────────────────────

router.post("/routes/:routeId/publish", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { force } = req.body || {};

  const { data: existing } = await db
    .from("routes")
    .select("id, employee_id, date, status, confidence, conflict_notes")
    .eq("id", req.params.routeId)
    .maybeSingle();

  if (!existing) return res.status(404).json({ error: "Route not found" });

  if (["published", "completed", "canceled"].includes((existing as any).status)) {
    return res.status(400).json({
      error: `Route is already ${(existing as any).status} — cannot publish again.`,
    });
  }

  const conflictNotes: string[] = (existing as any).conflict_notes ?? [];
  const confidence: string | null = (existing as any).confidence ?? null;
  const hasWarnings = confidence === "low" || conflictNotes.length > 0;

  if (hasWarnings && !force) {
    return res.status(400).json({
      error: "This route has unresolved warnings — review before publishing.",
      warnings: { confidence, conflict_notes: conflictNotes },
      hint: "Pass { force: true } to publish anyway (will be logged).",
    });
  }

  const now = new Date().toISOString();
  const { data: route, error } = await db
    .from("routes")
    .update({ status: "published", published_at: now, locked_at: now })
    .eq("id", req.params.routeId)
    .select("id, employee_id, date, status, published_at, total_distance_miles")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const { count: stopCount } = await db
    .from("route_stops")
    .select("id", { count: "exact" })
    .eq("route_id", req.params.routeId);

  void (async () => {
    try {
      const { notifyAdmin } = await import("../services/notifications/adminNotificationService");
      notifyAdmin({
        event_type: "scheduling.route_published",
        severity: "info",
        title: `Route published — ${stopCount ?? 0} stops for ${(route as any).date}`,
        entity_type: "route",
        entity_id: req.params.routeId,
        metadata: { employee_id: (route as any).employee_id, stop_count: stopCount },
      });
    } catch {}
  })();

  logRouteAudit(req.params.routeId, adminId, "admin", "route_published", {
    stop_count: stopCount,
    employee_id: (route as any).employee_id,
    confidence,
    conflict_notes_count: conflictNotes.length,
    published_with_warnings: hasWarnings,
    forced: !!force,
  });

  res.json({ success: true, route, message: `Route published with ${stopCount ?? 0} stops.` });
});

// ─── POST /api/admin/routes/:routeId/rebuild ─────────────────────────────────

router.post("/routes/:routeId/rebuild", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { data: existing } = await db.from("routes").select("id, employee_id, date, status").eq("id", req.params.routeId).single();
  if (!existing) return res.status(404).json({ error: "Route not found" });
  if (["published", "in_progress"].includes((existing as any).status)) {
    return res.status(400).json({ error: "Cannot rebuild a published or in-progress route" });
  }

  await db.from("route_stops").delete().eq("route_id", req.params.routeId);
  logRouteAudit(req.params.routeId, adminId, "admin", "route_rebuilt", { employee_id: (existing as any).employee_id });
  res.json({ success: true, message: "Route stops cleared. Generate route again to rebuild." });
});

// ─── POST /api/admin/routes/:routeId/assign ──────────────────────────────────

router.post("/routes/:routeId/assign", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { data: route, error } = await db
    .from("routes")
    .update({ status: "assigned" })
    .eq("id", req.params.routeId)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  logRouteAudit(req.params.routeId, adminId, "admin", "route_assigned");
  res.json({ success: true, route, message: "Route assigned to employee" });
});

// ─── POST /api/admin/routes/:routeId/discard ─────────────────────────────────

router.post("/routes/:routeId/discard", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  logRouteAudit(req.params.routeId, adminId, "admin", "route_discarded");
  const { error } = await db.from("routes").delete().eq("id", req.params.routeId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: "Route discarded" });
});

// ─── POST /api/admin/routes/:routeId/reorder ─────────────────────────────────

router.post("/routes/:routeId/reorder", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { stops } = req.body;
  if (!Array.isArray(stops) || stops.length === 0) return res.status(400).json({ error: "Invalid stops array" });

  await Promise.all(
    stops.map((s: any) => db.from("route_stops").update({ sequence_number: s.sequence_number }).eq("id", s.id))
  );

  logRouteAudit(req.params.routeId, adminId, "admin", "stop_reordered", { stop_count: stops.length });

  const { data: updated } = await db.from("route_stops").select("*").eq("route_id", req.params.routeId).order("sequence_number");
  res.json({ success: true, stops: updated });
});

// ─── PATCH /api/admin/routes/stops/:stopId ───────────────────────────────────

router.patch("/routes/stops/:stopId", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { notes, estimated_duration_minutes, sequence_number, status } = req.body;
  const updates: Record<string, any> = {};
  if (notes !== undefined) updates.notes = notes;
  if (estimated_duration_minutes !== undefined) updates.estimated_duration_minutes = estimated_duration_minutes;
  if (sequence_number !== undefined) updates.sequence_number = sequence_number;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });

  const { data: stop, error } = await db
    .from("route_stops")
    .update(updates)
    .eq("id", req.params.stopId)
    .select("id, route_id, sequence_number, status, notes")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (stop) logRouteAudit((stop as any).route_id, adminId, "admin", "stop_updated", { stop_id: req.params.stopId, updates });

  res.json({ success: true, stop });
});

// ─── POST /api/admin/routes/:routeId/complete ────────────────────────────────

router.post("/routes/:routeId/complete", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { data: route, error } = await db
    .from("routes")
    .update({ status: "completed" })
    .eq("id", req.params.routeId)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  logRouteAudit(req.params.routeId, adminId, "admin", "route_completed");
  res.json({ success: true, route });
});

// ─── GET /api/employee/routes/today ──────────────────────────────────────────

router.get("/employee/routes/today", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(header.slice(7));
  if (authErr || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data: emp } = await db
    .from("employees")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!emp) return res.status(401).json({ error: "Unauthorized" });

  const today = new Date().toISOString().slice(0, 10);

  const { data: route } = await db
    .from("routes")
    .select("id, date, status, confidence, conflict_notes, published_at, total_distance_miles, total_duration_minutes")
    .eq("employee_id", emp.id)
    .eq("date", today)
    .in("status", ["published", "assigned", "in_progress"])
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!route) return res.json({ route: null, stops: [], has_route: false });

  const { data: rawStops, error: stopsErr } = await db
    .from("route_stops")
    .select("id, sequence_number, status, arrival_eta, departure_eta, estimated_duration_minutes, notes, assignment_id")
    .eq("route_id", route.id)
    .order("sequence_number", { ascending: true });

  if (stopsErr) return res.status(500).json({ error: stopsErr.message });

  const assignmentIds = (rawStops || []).map((s: any) => s.assignment_id).filter(Boolean);
  let enrichment: Record<string, any> = {};

  if (assignmentIds.length > 0) {
    const { data: assignments } = await db
      .from("assignments")
      .select("id, status, appointment_id, appointments!inner(service_type, notes, user_id, property_id)")
      .in("id", assignmentIds);

    const userIds = [...new Set((assignments || []).map((a: any) => a.appointments?.user_id).filter(Boolean))];
    const propIds = [...new Set((assignments || []).map((a: any) => a.appointments?.property_id).filter(Boolean))];

    const [profilesRes, propsRes] = await Promise.all([
      userIds.length > 0 ? db.from("profiles").select("id, name, phone").in("id", userIds) : { data: [] },
      propIds.length > 0 ? db.from("properties").select("id, address, city, zip, lat, lng").in("id", propIds) : { data: [] },
    ]);

    const profileMap: Record<string, any> = {};
    ((profilesRes as any).data || []).forEach((p: any) => { profileMap[p.id] = p; });
    const propMap: Record<string, any> = {};
    ((propsRes as any).data || []).forEach((p: any) => { propMap[p.id] = p; });

    (assignments || []).forEach((a: any) => {
      const appt = a.appointments || {};
      const profile = profileMap[appt.user_id] ?? {};
      const prop = propMap[appt.property_id] ?? {};
      enrichment[a.id] = {
        assignment_status: a.status,
        service_type: appt.service_type,
        customer_name: profile.name ?? "Customer",
        customer_phone: profile.phone ?? null,
        address: prop.address ?? null,
        city: prop.city ?? null,
        zip: prop.zip ?? null,
        lat: prop.lat ?? null,
        lng: prop.lng ?? null,
      };
    });
  }

  const stops = (rawStops || []).map((s: any) => ({ ...s, ...(enrichment[s.assignment_id] ?? {}) }));
  res.json({ route, stops, has_route: true });
});

// ─── POST /api/admin/routes/optimize-preview ─────────────────────────────────
// Returns a proposed smart-optimized stop ordering without mutating the DB.

router.post("/routes/optimize-preview", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { routeId } = req.body;
  if (!routeId) return res.status(400).json({ error: "routeId required" });

  // Load route
  const { data: route } = await db
    .from("routes")
    .select("id, employee_id, date, status")
    .eq("id", routeId)
    .maybeSingle();

  if (!route) return res.status(404).json({ error: "Route not found" });

  // Load stops with assignment → appointment → property chain
  const { data: rawStops } = await db
    .from("route_stops")
    .select("id, sequence_number, estimated_duration_minutes, assignment_id")
    .eq("route_id", routeId)
    .order("sequence_number");

  if (!rawStops || rawStops.length === 0) {
    return res.json({ routeId, currentOrder: [], proposed: null });
  }

  const assignmentIds = rawStops.map((s: any) => s.assignment_id).filter(Boolean);
  const { data: assignments } = await db
    .from("assignments")
    .select("id, appointment_id, appointments!inner(property_id)")
    .in("id", assignmentIds);

  const propIds = [
    ...new Set(
      (assignments || [])
        .map((a: any) => a.appointments?.property_id)
        .filter(Boolean)
    ),
  ];
  const { data: props } = propIds.length
    ? await db
        .from("properties")
        .select("id, address, city, zip, lat, lng")
        .in("id", propIds)
    : { data: [] };

  const propMap: Record<string, any> = {};
  (props || []).forEach((p: any) => { propMap[p.id] = p; });
  const apptMap: Record<string, any> = {};
  (assignments || []).forEach((a: any) => { apptMap[a.id] = a; });

  // Build SmartStop array
  const smartStops: SmartStop[] = rawStops.map((s: any) => {
    const assignment = apptMap[s.assignment_id] ?? {};
    const propId = assignment.appointments?.property_id;
    const prop = propId ? propMap[propId] : null;
    const hasRealGeo = prop?.lat != null && prop?.lng != null;
    return {
      assignmentId: s.assignment_id,
      appointmentId: assignment.appointment_id ?? "",
      address: prop ? `${prop.address}, ${prop.city} ${prop.zip}` : s.assignment_id,
      geo: hasRealGeo
        ? { latitude: prop.lat, longitude: prop.lng }
        : undefined,
      estimatedServiceMinutes: s.estimated_duration_minutes ?? 45,
      isMockGeo: !hasRealGeo,
    };
  });

  // Load technician capacity for home_base + drive cap
  const { data: capProfile } = await db
    .from("technician_capacity_profiles")
    .select("home_base_lat, home_base_lng, max_drive_minutes_per_day")
    .eq("employee_id", route.employee_id)
    .maybeSingle();

  const depotGeo =
    capProfile?.home_base_lat != null && capProfile?.home_base_lng != null
      ? { latitude: capProfile.home_base_lat, longitude: capProfile.home_base_lng }
      : undefined;

  const startTime = new Date(`${route.date}T08:00:00`);

  const proposed = smartOptimizeRoute({
    stops: smartStops,
    depotGeo,
    startTime,
    maxDriveMinutes: capProfile?.max_drive_minutes_per_day ?? undefined,
  });

  // Current ordering stats (for comparison)
  const currentOrder = smartStops.map((s, i) => ({
    sequenceNumber: i + 1,
    assignmentId: s.assignmentId,
    address: s.address,
    isMockGeo: s.isMockGeo,
  }));

  res.json({ routeId, currentOrder, proposed });
});

// ─── POST /api/admin/routes/:routeId/reorder-stops ───────────────────────────
// Applies a new stop order to an existing draft or approved route.
// Body: { orderedAssignmentIds: string[] }

router.post("/routes/:routeId/reorder-stops", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { orderedAssignmentIds } = req.body;
  if (!Array.isArray(orderedAssignmentIds) || orderedAssignmentIds.length === 0) {
    return res.status(400).json({ error: "orderedAssignmentIds array required" });
  }

  const { data: route } = await db
    .from("routes")
    .select("id, status, employee_id, date")
    .eq("id", req.params.routeId)
    .maybeSingle();

  if (!route) return res.status(404).json({ error: "Route not found" });
  if (!["draft", "approved"].includes(route.status)) {
    return res.status(400).json({ error: "Can only reorder draft or approved routes" });
  }

  const { data: stops } = await db
    .from("route_stops")
    .select("id, assignment_id, estimated_duration_minutes")
    .eq("route_id", req.params.routeId);

  const stopByAssignment: Record<string, any> = {};
  (stops || []).forEach((s: any) => { stopByAssignment[s.assignment_id] = s; });

  // Rebuild smart-optimized ETAs for the given order
  const orderedStops = orderedAssignmentIds
    .map((aid) => stopByAssignment[aid])
    .filter(Boolean);

  if (orderedStops.length === 0) return res.status(400).json({ error: "No matching stops found" });

  // Fetch property coords for ETA recalculation
  const assignmentIds = orderedStops.map((s: any) => s.assignment_id);
  const { data: assignments } = await db
    .from("assignments")
    .select("id, appointments!inner(property_id)")
    .in("id", assignmentIds);

  const propIds = [
    ...new Set(
      (assignments || []).map((a: any) => a.appointments?.property_id).filter(Boolean)
    ),
  ];
  const { data: props } = propIds.length
    ? await db.from("properties").select("id, lat, lng").in("id", propIds)
    : { data: [] };

  const propMap: Record<string, any> = {};
  (props || []).forEach((p: any) => { propMap[p.id] = p; });
  const apptMap: Record<string, any> = {};
  (assignments || []).forEach((a: any) => { apptMap[a.id] = a; });

  const { data: capProfile } = await db
    .from("technician_capacity_profiles")
    .select("home_base_lat, home_base_lng, max_drive_minutes_per_day")
    .eq("employee_id", route.employee_id)
    .maybeSingle();

  const depotGeo =
    capProfile?.home_base_lat != null && capProfile?.home_base_lng != null
      ? { latitude: capProfile.home_base_lat, longitude: capProfile.home_base_lng }
      : undefined;

  const smartStops: SmartStop[] = orderedStops.map((s: any) => {
    const assignment = apptMap[s.assignment_id] ?? {};
    const propId = assignment.appointments?.property_id;
    const prop = propId ? propMap[propId] : null;
    const hasRealGeo = prop?.lat != null && prop?.lng != null;
    return {
      assignmentId: s.assignment_id,
      appointmentId: assignment.appointment_id ?? "",
      address: "",
      geo: hasRealGeo ? { latitude: prop.lat, longitude: prop.lng } : undefined,
      estimatedServiceMinutes: s.estimated_duration_minutes ?? 45,
      isMockGeo: !hasRealGeo,
    };
  });

  const startTime = new Date(`${route.date}T08:00:00`);
  const result = smartOptimizeRoute({
    stops: smartStops,
    depotGeo,
    startTime,
    maxDriveMinutes: capProfile?.max_drive_minutes_per_day ?? undefined,
  });

  // Update sequence_number and ETAs for each stop
  const updates = result.stops.map((rs, i) => {
    const stop = orderedStops[i];
    return db.from("route_stops").update({
      sequence_number: rs.sequenceNumber,
      arrival_eta: rs.arrivalEta,
      departure_eta: rs.departureEta,
      distance_from_prev_miles: rs.distanceFromPrevMiles,
      duration_from_prev_minutes: Math.round(rs.driveMinutesFromPrev),
    }).eq("id", stop.id);
  });

  await Promise.all(updates);

  // Update route totals and mark as smart-optimized
  await db.from("routes").update({
    total_distance_miles: Math.round(result.totalDistanceMiles * 10) / 10,
    total_duration_minutes: Math.round(result.totalDriveMinutes + result.totalServiceMinutes),
    algorithm_version: result.algorithmVersion,
  }).eq("id", req.params.routeId);

  logRouteAudit(req.params.routeId, adminId, "admin", "smart_reorder", {
    stop_count: result.stops.length,
    distance_saved_miles: result.improvement.distanceSavedMiles,
    time_saved_minutes: result.improvement.timeSavedMinutes,
    depot_geo_used: !!depotGeo,
  });

  const { data: updatedStops } = await db
    .from("route_stops")
    .select("*")
    .eq("route_id", req.params.routeId)
    .order("sequence_number");

  res.json({ success: true, stops: updatedStops, improvement: result.improvement });
});

// ─── Routing Automation Policy ────────────────────────────────────────────────

// GET /api/admin/routes/automation-settings
router.get("/routes/automation-settings", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const settings = await getRouteAutomationSettings();
  res.json({ settings });
});

// PATCH /api/admin/routes/automation-settings
router.patch("/routes/automation-settings", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const allowedFields = [
    "mode", "review_window_minutes", "auto_publish_cutoff_time",
    "require_smart_optimize", "block_low_confidence", "block_mock_geo",
    "block_drive_cap_exceeded", "enabled",
    // Platform Growth Phase 2
    "auto_generate_enabled", "auto_optimize_enabled", "auto_generate_time",
    "auto_generate_days", "require_admin_review_before_publish", "allow_full_auto_publish",
  ];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update" });

  if (updates.mode && !["manual_only", "review_window", "fully_automatic"].includes(updates.mode)) {
    return res.status(400).json({ error: "Invalid mode" });
  }

  try {
    const settings = await updateRouteAutomationSettings(updates);
    logRouteAudit("automation-settings", adminId, "admin", "automation_settings_updated", { updates });
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/routes/automation/run-now
// Manually triggers the same full sweep the scheduled job runs (generate +
// optimize, then publish) — useful for admins to test settings without
// waiting for the cron interval. Each stage remains gated by its own
// settings exactly as it is when the scheduled job calls it — this endpoint
// does not bypass any toggle, it just runs the same logic on demand.
router.post("/routes/automation/run-now", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const { date } = req.body;
  if (!date) return res.status(400).json({ error: "date required" });

  try {
    const generateResult = await autoGenerateAndOptimizeDayPlans([date]);
    const publishResult = await autoPublishEligibleRoutes(date);

    logRouteAudit("automation-run-" + date, adminId, "admin", "automation_manual_run", {
      date,
      generated: generateResult.routesGenerated,
      optimized: generateResult.routesOptimized,
      generate_skipped_reason: generateResult.skippedReason ?? null,
      checked: publishResult.checked, published: publishResult.published,
      blocked: publishResult.blocked, skipped: publishResult.skipped,
    });

    res.json({ success: true, generate: generateResult, publish: publishResult });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/routes/automation/history
// Recent system-actor route_audit_log entries — lets an admin see exactly
// what automation has done (and what it declined to do, and why) without
// digging through the per-route audit trail one route at a time.
router.get("/routes/automation/history", async (req, res) => {
  const adminId = await getAdminUserId(req);
  if (!adminId) return res.status(403).json({ error: "Admin required" });

  const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);

  const { data, error } = await db
    .from("route_audit_log")
    .select("id, route_id, action, metadata, created_at")
    .eq("actor_role", "system")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ history: data ?? [] });
});

export default router;
