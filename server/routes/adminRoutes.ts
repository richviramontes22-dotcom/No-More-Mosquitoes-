import express from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { optimizeRoute, type AssignmentForRouting } from "../lib/routeOptimization";
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

type CoordSource = "property_coordinates" | "mock_fallback";

interface ResolvedCoord {
  latitude: number;
  longitude: number;
  source: CoordSource;
}

function resolveCoordinates(prop: any): ResolvedCoord {
  const lat = prop?.lat ?? prop?.latitude;
  const lng = prop?.lng ?? prop?.longitude;
  if (typeof lat === "number" && typeof lng === "number" && lat !== 0 && lng !== 0) {
    return { latitude: lat, longitude: lng, source: "property_coordinates" };
  }
  return { ...mockGeocodeAddress(prop?.address ?? "", prop?.zip ?? ""), source: "mock_fallback" };
}

function mockGeocodeAddress(address: string, zip: string): { latitude: number; longitude: number } {
  const zipHash = (zip || "90000")
    .split("")
    .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
  return {
    latitude:  33.7 + (zipHash % 100) / 1000,
    longitude: -117.9 + (zipHash % 100) / 1000,
  };
}

function calculateConfidence(
  totalStops: number,
  mockCount: number,
  conflictNotes: string[]
): "high" | "medium" | "low" {
  if (mockCount === 0 && conflictNotes.length === 0) return "high";
  if (mockCount <= 2 && conflictNotes.length <= 1) return "medium";
  return "low";
}

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

  const reqId = (req as any).requestId || adminId;
  const genStart = Date.now();

  try {
    checkpoint(reqId, CP.ROUTE_DAY_GENERATE_START, { date, max_stops_per_tech });
    logger.info("route.day_generate.started", { requestId: reqId, date });

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
      return res.status(400).json({
        error: `Cannot generate routes — this date is a company blackout: ${(companyBlackout as any).reason ?? "closed"}`,
        reason: "company_blackout",
      });
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
      // Fire admin alert
      void (async () => {
        try {
          const { notifyAdmin } = await import("../services/notifications/adminNotificationService");
          notifyAdmin({
            event_type: "workforce.no_technicians_available",
            severity: "critical",
            title: `No technicians available for ${date}`,
            body: `All active technicians are unavailable on ${date}. Routes cannot be generated.`,
            metadata: { date, excluded_count: allTechnicians.length },
          });
        } catch {}
      })();
      return res.json({ success: true, message: "No technicians available for this date — all active technicians are unavailable or on time off", routes: [], unassigned_appointments: [], conflict_notes: dayConflictNotes });
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
      return res.json({ success: true, message: "All appointments are already on approved routes", routes: [], unassigned: [] });
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
      // Assign entire ZIP group to the technician with fewest stops
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

      // Respect per-technician capacity (from workforce availability service)
      const techMaxStops = techCapacities[tech.id] ?? max_stops_per_tech;
      const withinCap = techAppts.slice(0, techMaxStops);
      const overflow = techAppts.slice(techMaxStops);
      if (overflow.length > 0) {
        dayConflictNotes.push(`Technician ${tech.id.slice(0, 8)}: ${overflow.length} appointment(s) over capacity (${techMaxStops} max)`);
      }
      unassigned.push(...overflow);

      // Check for existing draft route for this tech on this date (avoid duplicates)
      const { data: existingDraft } = await db
        .from("routes")
        .select("id, status")
        .eq("employee_id", tech.id)
        .eq("date", date)
        .in("status", ["draft", "approved"])
        .limit(1)
        .maybeSingle();

      if (existingDraft) {
        // Skip — already has a draft or approved route
        continue;
      }

      // Resolve coordinates and build assignments
      const coordSources: Record<string, CoordSource> = {};
      const conflictNotes: string[] = [];
      const assignments: AssignmentForRouting[] = [];

      for (const appt of withinCap) {
        // Find or create assignment for this appointment + technician
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
          // Create assignment
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
          created_by: adminId,
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

      logRouteAudit(routeData.id, adminId, "admin", "route_generated", {
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

    res.json({
      success: true,
      date,
      routes: createdRoutes,
      unassigned_appointments: unassigned,
      workforce_notes: dayConflictNotes,
      excluded_technicians: unavailableTechIds.size,
      message: `Created ${createdRoutes.length} draft route(s). ${unassigned.length} appointment(s) unassigned. ${unavailableTechIds.size} technician(s) excluded due to availability.`,
    });
  } catch (err: any) {
    checkpoint(reqId, CP.ROUTE_GENERATE_FAILED, { date, error: (err as any)?.message });
    logger.error("route.day_generate.failed", err, { requestId: reqId, date });
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
    .select("id, employee_id")
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

  routeIds.forEach((id) => logRouteAudit(id, adminId, "admin", "route_published", { bulk: true, date }));

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
    stop_count: stopCount, employee_id: (route as any).employee_id,
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

export default router;
