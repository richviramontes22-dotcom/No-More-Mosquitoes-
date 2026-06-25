import { Router } from "express";
import { format, startOfDay, addDays } from "date-fns";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";
import { getTerritoryIntelligence } from "../services/analytics/territoryIntelligenceService";
import { getRouteAutomationSettings } from "../services/routing/routeAutomationPolicy";
import { getLastPingsByEmployee, isStale, STALE_THRESHOLD_MINUTES } from "../services/tracking/lastPings";
import { getTechnicianStatusList } from "../services/tracking/technicianStatus";

const db = supabaseAdmin ?? supabase;
const router = Router();

/**
 * GET /api/admin/operations/summary
 *
 * Single-pane-of-glass aggregator for the Operations Command Center
 * (/admin/operations). Read-only — composes existing data and existing
 * analytics services (getTerritoryIntelligence, getRouteAutomationSettings);
 * does not duplicate their logic or introduce a parallel scoring system.
 * The handful of counts with no existing equivalent (today's appointment/
 * route/ticket counts, technician clock-in state) are simple, single-purpose
 * queries — not a new analytics engine.
 */
router.get("/operations/summary", requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    // Local server day, not UTC — must match shifts.shift_date /
    // employeeShifts.ts's clock-in date (date-fns `format`, local time).
    // Using toISOString().slice(0,10) here previously meant "today" was the
    // UTC date, silently off by one from the shifts table for hours each
    // day (here, UTC-7 -> wrong from midnight UTC until midnight local).
    const today = format(now, "yyyy-MM-dd");
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = addDays(startOfDay(now), 1).toISOString();
    const nowIso = now.toISOString();

    const [
      { count: appointmentsToday },
      { count: noShowToday },
      { data: openShiftsToday },
      { count: routesToday },
      routeAutomationSettings,
      { data: draftRoutes },
      { data: approvedRoutes },
      { data: openTickets },
      { data: escalatedTickets },
      { data: overdueTickets },
      { data: detractors },
      { data: rescheduleRequests },
      { count: reschedulesToday },
      { count: failedPaymentsToday },
      { data: inactiveTechnicians },
      { data: allActiveTechnicians },
      territoryIntelligence,
    ] = await Promise.all([
      db.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_at", todayStart).lt("scheduled_at", todayEnd),
      db.from("appointments").select("id", { count: "exact", head: true }).eq("status", "no_show").gte("scheduled_at", todayStart).lt("scheduled_at", todayEnd),
      db.from("shifts").select("id, employee_id").eq("shift_date", today).is("clock_out_at", null),
      db.from("routes").select("id", { count: "exact", head: true }).eq("date", today),
      getRouteAutomationSettings(),
      db.from("routes").select("id, date").eq("status", "draft").gte("date", today),
      db.from("routes").select("id, date").eq("status", "approved").gte("date", today),
      db.from("tickets").select("id, subject, priority, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(50),
      db.from("tickets").select("id, subject, priority, created_at").eq("status", "escalated").order("created_at", { ascending: false }).limit(50),
      db.from("tickets").select("id, subject, due_at").not("due_at", "is", null).lt("due_at", nowIso).not("status", "in", '("resolved","closed")'),
      db.from("customer_satisfaction_surveys").select("id, rating, created_at").eq("satisfaction_type", "detractor").eq("followup_required", true).is("resolved_at", null),
      db.from("appointment_reschedule_requests").select("id, created_at").eq("status", "pending"),
      db.from("appointment_reschedule_requests").select("id", { count: "exact", head: true }).eq("status", "pending").gte("created_at", todayStart).lt("created_at", todayEnd),
      db.from("notification_log").select("id", { count: "exact", head: true }).eq("notification_type", "payment_failed").gte("created_at", todayStart).lt("created_at", todayEnd),
      db.from("employees").select("id").neq("status", "active").in("role", ["technician", "dispatcher"]),
      db.from("employees").select("id, gps_consent_at").eq("status", "active").in("role", ["technician", "dispatcher"]),
      getTerritoryIntelligence({ areaFilter: "out_of_area" }),
    ]);

    // Technician status board — reuses the same status derivation as
    // /api/admin/tracking/employees (assignments.status), plus clock state
    // from shifts. Not a new tracking system — composes the two existing
    // sources side by side.
    const clockedInIds = new Set((openShiftsToday ?? []).map((s: any) => s.employee_id));
    const activeTechIds = (allActiveTechnicians ?? []).map((t: any) => t.id);

    let assignmentStatusByEmployee: Record<string, string> = {};
    if (activeTechIds.length > 0) {
      const { data: activeAssignments } = await db
        .from("assignments")
        .select("employee_id, status")
        .in("employee_id", activeTechIds)
        .in("status", ["en_route", "in_progress", "completed", "no_show", "skipped"]);
      (activeAssignments ?? []).forEach((a: any) => {
        // Last-write-wins per technician is fine here — this is a same-day
        // snapshot count, not a historical ledger.
        assignmentStatusByEmployee[a.employee_id] = a.status;
      });
    }

    let clockedIn = 0, onRoute = 0, onAppointment = 0, completed = 0, blockedOrUnableToService = 0;
    for (const techId of activeTechIds) {
      if (!clockedInIds.has(techId)) continue;
      clockedIn++;
      const status = assignmentStatusByEmployee[techId];
      if (status === "en_route") onRoute++;
      else if (status === "in_progress") onAppointment++;
      else if (status === "completed") completed++;
      else if (status === "no_show" || status === "skipped") blockedOrUnableToService++;
    }

    // GPS summary — reuses the same shared last-ping lookup as
    // /api/admin/tracking/employees (server/services/tracking/lastPings.ts),
    // not a parallel tracking system. Only computed for technicians
    // currently clocked in, since staleness/sharing status isn't meaningful
    // for someone off shift.
    const consentByEmployee: Record<string, boolean> = {};
    (allActiveTechnicians ?? []).forEach((t: any) => { consentByEmployee[t.id] = !!t.gps_consent_at; });
    const clockedInTechIds = activeTechIds.filter((id) => clockedInIds.has(id));
    const lastPingsByEmployee = await getLastPingsByEmployee(
      clockedInTechIds.filter((id) => consentByEmployee[id])
    );

    let gpsSharing = 0, gpsStale = 0, gpsNoConsent = 0;
    for (const techId of clockedInTechIds) {
      if (!consentByEmployee[techId]) { gpsNoConsent++; continue; }
      const lastPing = lastPingsByEmployee.get(techId);
      if (lastPing && !isStale(lastPing.captured_at)) gpsSharing++;
      else gpsStale++;
    }

    res.json({
      generated_at: nowIso,
      today: {
        date: today,
        appointments_today: appointmentsToday ?? 0,
        active_technicians: clockedIn,
        routes_today: routesToday ?? 0,
        tickets_today: (openTickets ?? []).filter((t: any) => t.created_at >= todayStart && t.created_at < todayEnd).length,
        detractors_today: (detractors ?? []).filter((d: any) => d.created_at >= todayStart && d.created_at < todayEnd).length,
        reschedules_today: reschedulesToday ?? 0,
      },
      technician_status: {
        clocked_in: clockedIn,
        clocked_out: activeTechIds.length - clockedIn,
        on_route: onRoute,
        on_appointment: onAppointment,
        completed_today: completed,
        blocked_or_unable_to_service: blockedOrUnableToService,
      },
      gps: {
        // All counts are scoped to technicians currently clocked in — GPS
        // status isn't meaningful for someone off shift.
        clocked_in_sharing: gpsSharing,
        clocked_in_stale_or_silent: gpsStale,
        clocked_in_no_consent: gpsNoConsent,
        stale_threshold_minutes: STALE_THRESHOLD_MINUTES,
        live_tracking_link: "/admin/employee-tracking",
      },
      customer_service: {
        open_tickets: (openTickets ?? []).length,
        escalations: (escalatedTickets ?? []).length,
        detractors: (detractors ?? []).length,
        pending_reschedule_requests: (rescheduleRequests ?? []).length,
      },
      alerts: {
        routes_awaiting_approval: (draftRoutes ?? []).length,
        routes_pending_publish: (approvedRoutes ?? []).length,
        route_automation_enabled: routeAutomationSettings.enabled,
        route_automation_mode: routeAutomationSettings.mode,
        overdue_tickets: (overdueTickets ?? []).length,
        failed_appointments_today: noShowToday ?? 0,
        failed_payments_today: failedPaymentsToday ?? 0,
        inactive_technicians: (inactiveTechnicians ?? []).length,
      },
      service_area_insights: {
        uncovered_zip_count: territoryIntelligence.zips.filter((z) => z.service_status === "unmapped").length,
        top_opportunities: territoryIntelligence.zips
          .filter((z) => z.recommendation === "expansion_candidate" || z.recommendation === "activate_zip")
          .sort((a, b) => b.opportunity_score - a.opportunity_score)
          .slice(0, 10)
          .map((z) => ({ zip: z.zip, opportunity_score: z.opportunity_score, recommendation: z.recommendation, demand_count: z.demand_count })),
      },
    });
  } catch (err: any) {
    console.error("[adminOperations] summary failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/operations/dispatch-map
 *
 * Dispatch map data for the Operations Command Center — technician
 * positions (reusing getTechnicianStatusList(), the same function backing
 * /api/admin/tracking/employees — not a second tracking implementation)
 * plus today's route stops with coordinates and status, including
 * blocked/no-show flagging. Read-only aggregation of existing tables
 * (routes, route_stops, assignments, appointments, properties) — does not
 * touch the routing engine itself.
 */
router.get("/operations/dispatch-map", requireAdmin, async (_req, res) => {
  try {
    const today = format(new Date(), "yyyy-MM-dd");

    const [technicians, routesRes] = await Promise.all([
      getTechnicianStatusList(),
      db.from("routes").select("id, employee_id, status").eq("date", today).in("status", ["draft", "approved", "published", "assigned", "in_progress"]),
    ]);

    const routes = routesRes.data || [];
    const routeIds = routes.map((r: any) => r.id);
    const routeEmployeeMap: Record<string, string> = {};
    routes.forEach((r: any) => { routeEmployeeMap[r.id] = r.employee_id; });

    let stops: any[] = [];
    if (routeIds.length > 0) {
      const { data: rawStops } = await db
        .from("route_stops")
        .select("id, route_id, sequence_number, status, arrival_eta, assignment_id")
        .in("route_id", routeIds)
        .order("sequence_number", { ascending: true });

      const assignmentIds = [...new Set((rawStops || []).map((s: any) => s.assignment_id).filter(Boolean))];
      let enrichment: Record<string, any> = {};

      if (assignmentIds.length > 0) {
        const { data: assignments } = await db
          .from("assignments")
          .select("id, status, appointment_id, appointments!inner(property_id)")
          .in("id", assignmentIds);

        const propIds = [...new Set((assignments || []).map((a: any) => a.appointments?.property_id).filter(Boolean))];
        const { data: properties } = propIds.length > 0
          ? await db.from("properties").select("id, address, lat, lng").in("id", propIds)
          : { data: [] };

        const propMap: Record<string, any> = {};
        (properties || []).forEach((p: any) => { propMap[p.id] = p; });

        (assignments || []).forEach((a: any) => {
          const prop = propMap[a.appointments?.property_id] ?? {};
          enrichment[a.id] = {
            assignment_status: a.status,
            address: prop.address ?? null,
            lat: typeof prop.lat === "number" ? prop.lat : null,
            lng: typeof prop.lng === "number" ? prop.lng : null,
          };
        });
      }

      stops = (rawStops || []).map((s: any) => {
        const enrich = enrichment[s.assignment_id] ?? {};
        return {
          id: s.id,
          route_id: s.route_id,
          employee_id: routeEmployeeMap[s.route_id] ?? null,
          sequence_number: s.sequence_number,
          status: enrich.assignment_status ?? s.status,
          arrival_eta: s.arrival_eta,
          address: enrich.address ?? null,
          lat: enrich.lat ?? null,
          lng: enrich.lng ?? null,
          is_blocked: enrich.assignment_status === "no_show" || enrich.assignment_status === "skipped",
        };
      });
    }

    res.json({
      generated_at: new Date().toISOString(),
      technicians,
      stops,
      stale_threshold_minutes: STALE_THRESHOLD_MINUTES,
      links: {
        employee_tracking: "/admin/employee-tracking",
        route_planning: "/admin/route-planning",
      },
    });
  } catch (err: any) {
    console.error("[adminOperations] dispatch-map failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
