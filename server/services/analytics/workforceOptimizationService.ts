import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getTerritoryIntelligence } from "./territoryIntelligenceService";

const db = supabaseAdmin ?? supabase;

export type WorkforceRecommendation =
  | "add_technician"
  | "reduce_active_zips_temporarily"
  | "add_coverage_in_county"
  | "watch_demand"
  | "rebalance_routes"
  | "no_action_needed";

export interface TechnicianUtilizationRow {
  employee_id: string;
  technician_label: string;
  is_test: boolean;
  available_days: number;
  scheduled_appointments: number;
  completed_appointments: number;
  capacity: number;
  utilization_pct: number | null; // null = capacity is 0, can't compute a ratio
  route_miles: number;
  estimated_drive_minutes: number;
  estimated_service_minutes: number;
  overload_warning: boolean;
  overload_reason: string | null;
}

export interface CapacityForecastRow {
  date: string;
  available_technicians: number;
  total_stop_capacity: number;
  scheduled_stops: number;
  remaining_capacity: number;
  demand_pressure: "low" | "moderate" | "high" | "over_capacity";
  recommendation: WorkforceRecommendation;
  recommendation_reason: string;
}

export interface TerritoryStaffingRow {
  county: string;
  appointment_demand: number;
  technician_coverage: number;
  active_service_zips: number;
  overload_risk: "low" | "moderate" | "high";
  recommendation: WorkforceRecommendation;
  recommendation_reason: string;
}

export interface WorkforceOptimizationFilters {
  dateFrom?: string; // YYYY-MM-DD, defaults to today
  dateTo?: string;   // YYYY-MM-DD, defaults to dateFrom + 13 days
}

export interface WorkforceOptimizationResult {
  technician_utilization: TechnicianUtilizationRow[];
  capacity_forecast: CapacityForecastRow[];
  territory_staffing: TerritoryStaffingRow[];
  generated_at: string;
  forecast_window: { from: string; to: string };
}

const GLOBAL_DEFAULT_MAX_STOPS = 8;

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur <= end) {
    dates.push(toDateOnly(cur));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

/**
 * Read-only workforce decision support. This re-derives the same
 * availability/capacity priority rules as
 * isTechnicianAvailable()/getEffectiveDailyCapacity() (server/lib/), but
 * computed from bulk-fetched data across all technicians and the whole
 * forecast window at once, instead of calling those per-technician,
 * per-date functions in a loop (which would be an N+1 query pattern for a
 * dashboard). Approved-time-off requests are not checked here — the
 * canonical functions treat that table as optional/best-effort too.
 *
 * Never writes anything. No employee schedule, service area, or assignment
 * is ever touched by this service.
 */
export async function getWorkforceOptimization(
  filters: WorkforceOptimizationFilters = {},
): Promise<WorkforceOptimizationResult> {
  const dateFrom = filters.dateFrom ?? toDateOnly(new Date());
  const dateTo = filters.dateTo ?? toDateOnly(new Date(new Date(dateFrom + "T00:00:00Z").getTime() + 13 * 24 * 60 * 60 * 1000));
  const forecastDates = eachDate(dateFrom, dateTo);

  const [
    { data: employees },
    { data: capacityProfiles },
    { data: scheduleTemplates },
    { data: dateOverrides },
    { data: blackouts },
    { data: assignments },
    { data: appointments },
    { data: routes },
  ] = await Promise.all([
    db.from("employees").select("id, user_id, role, status, default_max_stops, service_area_ids, is_test").in("role", ["technician", "dispatcher"]),
    db.from("technician_capacity_profiles").select("employee_id, max_stops_per_day"),
    db.from("technician_schedule_templates").select("employee_id, day_of_week, is_working, max_stops, effective_from, effective_until"),
    db.from("technician_date_overrides").select("employee_id, override_date, is_available, max_stops_override"),
    db.from("blackout_dates").select("date, scope, employee_id"),
    db.from("assignments").select("id, appointment_id, employee_id, status"),
    db.from("appointments").select("id, scheduled_at, scheduled_date, status"),
    db.from("routes").select("id, employee_id, date, total_distance_miles, total_duration_minutes, status"),
  ]);

  const activeEmployees = (employees ?? []).filter((e: any) => e.status === "active");

  const capacityByEmployee = new Map<string, number>();
  (capacityProfiles ?? []).forEach((c: any) => capacityByEmployee.set(c.employee_id, c.max_stops_per_day));

  const templatesByEmployee = new Map<string, any[]>();
  (scheduleTemplates ?? []).forEach((t: any) => {
    if (!templatesByEmployee.has(t.employee_id)) templatesByEmployee.set(t.employee_id, []);
    templatesByEmployee.get(t.employee_id)!.push(t);
  });

  const overridesByEmployeeDate = new Map<string, any>();
  (dateOverrides ?? []).forEach((o: any) => overridesByEmployeeDate.set(`${o.employee_id}|${o.override_date}`, o));

  const companyBlackoutDates = new Set<string>();
  const employeeBlackouts = new Map<string, Set<string>>();
  (blackouts ?? []).forEach((b: any) => {
    if (b.scope === "all") companyBlackoutDates.add(b.date);
    else if (b.scope === "employee" && b.employee_id) {
      if (!employeeBlackouts.has(b.employee_id)) employeeBlackouts.set(b.employee_id, new Set());
      employeeBlackouts.get(b.employee_id)!.add(b.date);
    }
  });

  function resolveDay(employee: any, date: string): { available: boolean; capacity: number } {
    if (companyBlackoutDates.has(date)) return { available: false, capacity: 0 };
    if (employeeBlackouts.get(employee.id)?.has(date)) return { available: false, capacity: 0 };

    const override = overridesByEmployeeDate.get(`${employee.id}|${date}`);
    if (override) {
      if (!override.is_available) return { available: false, capacity: 0 };
      return { available: true, capacity: override.max_stops_override ?? capacityByEmployee.get(employee.id) ?? employee.default_max_stops ?? GLOBAL_DEFAULT_MAX_STOPS };
    }

    const dayOfWeek = new Date(date + "T00:00:00Z").getDay();
    const templates = (templatesByEmployee.get(employee.id) ?? []).filter(
      (t: any) => t.day_of_week === dayOfWeek && t.effective_from <= date && (!t.effective_until || t.effective_until >= date),
    );
    const template = templates.sort((a: any, b: any) => (a.effective_from < b.effective_from ? 1 : -1))[0];
    if (template) {
      if (!template.is_working) return { available: false, capacity: 0 };
      return { available: true, capacity: template.max_stops ?? capacityByEmployee.get(employee.id) ?? employee.default_max_stops ?? GLOBAL_DEFAULT_MAX_STOPS };
    }

    // No override, no template — default available (matches isTechnicianAvailable's
    // backward-compatible default), using whatever capacity source applies.
    return { available: true, capacity: capacityByEmployee.get(employee.id) ?? employee.default_max_stops ?? GLOBAL_DEFAULT_MAX_STOPS };
  }

  const assignmentsByEmployee = new Map<string, any[]>();
  (assignments ?? []).forEach((a: any) => {
    if (!assignmentsByEmployee.has(a.employee_id)) assignmentsByEmployee.set(a.employee_id, []);
    assignmentsByEmployee.get(a.employee_id)!.push(a);
  });

  const appointmentById = new Map<string, any>();
  (appointments ?? []).forEach((a: any) => appointmentById.set(a.id, a));

  const routesByEmployee = new Map<string, any[]>();
  (routes ?? []).forEach((r: any) => {
    if (!routesByEmployee.has(r.employee_id)) routesByEmployee.set(r.employee_id, []);
    routesByEmployee.get(r.employee_id)!.push(r);
  });

  // ─── Technician Utilization ─────────────────────────────────────────────
  const technicianUtilization: TechnicianUtilizationRow[] = activeEmployees.map((emp: any) => {
    let availableDays = 0;
    let capacity = 0;
    for (const date of forecastDates) {
      const day = resolveDay(emp, date);
      if (day.available) {
        availableDays++;
        capacity += day.capacity;
      }
    }

    const empAssignments = assignmentsByEmployee.get(emp.id) ?? [];
    const scheduledAppointments = empAssignments.length;
    const completedAppointments = empAssignments.filter((a: any) => a.status === "completed").length;

    const empRoutes = (routesByEmployee.get(emp.id) ?? []).filter((r: any) => forecastDates.includes(r.date));
    const routeMiles = empRoutes.reduce((s: number, r: any) => s + (r.total_distance_miles ?? 0), 0);
    const totalRouteMinutes = empRoutes.reduce((s: number, r: any) => s + (r.total_duration_minutes ?? 0), 0);
    // No per-leg drive/service split exists at the route-total level (only
    // route_stops carries that detail, and it's empty in production today) —
    // report the combined total as drive minutes and leave service minutes
    // at 0 rather than guess a split.
    const estimatedDriveMinutes = totalRouteMinutes;
    const estimatedServiceMinutes = 0;

    const utilizationPct = capacity > 0 ? Math.round((scheduledAppointments / capacity) * 1000) / 10 : null;
    const overloadWarning = utilizationPct != null && utilizationPct > 100;

    return {
      employee_id: emp.id,
      technician_label: `Technician ${String(emp.id).slice(0, 8)}`,
      is_test: !!emp.is_test,
      available_days: availableDays,
      scheduled_appointments: scheduledAppointments,
      completed_appointments: completedAppointments,
      capacity,
      utilization_pct: utilizationPct,
      route_miles: Math.round(routeMiles * 10) / 10,
      estimated_drive_minutes: Math.round(estimatedDriveMinutes),
      estimated_service_minutes: Math.round(estimatedServiceMinutes),
      overload_warning: overloadWarning,
      overload_reason: overloadWarning ? `Scheduled appointments (${scheduledAppointments}) exceed available capacity (${capacity}) over this window` : null,
    };
  });

  // ─── Capacity Forecast ──────────────────────────────────────────────────
  // Demand per day from appointments.scheduled_date (the day-level field);
  // falls back to the date portion of scheduled_at for legacy rows.
  const appointmentsByDate = new Map<string, number>();
  (appointments ?? []).forEach((a: any) => {
    const date = a.scheduled_date ?? (a.scheduled_at ? String(a.scheduled_at).slice(0, 10) : null);
    if (!date || !["scheduled", "confirmed", "in_progress"].includes(a.status)) return;
    appointmentsByDate.set(date, (appointmentsByDate.get(date) ?? 0) + 1);
  });

  const capacityForecast: CapacityForecastRow[] = forecastDates.map((date) => {
    let availableTechnicians = 0;
    let totalStopCapacity = 0;
    for (const emp of activeEmployees) {
      const day = resolveDay(emp, date);
      if (day.available) {
        availableTechnicians++;
        totalStopCapacity += day.capacity;
      }
    }

    const scheduledStops = appointmentsByDate.get(date) ?? 0;
    const remainingCapacity = totalStopCapacity - scheduledStops;
    const ratio = totalStopCapacity > 0 ? scheduledStops / totalStopCapacity : scheduledStops > 0 ? Infinity : 0;

    let demandPressure: CapacityForecastRow["demand_pressure"];
    let recommendation: WorkforceRecommendation;
    let recommendationReason: string;

    if (ratio > 1) {
      demandPressure = "over_capacity";
      if (availableTechnicians === 0) {
        recommendation = "add_technician";
        recommendationReason = `${scheduledStops} appointment(s) scheduled with zero available technicians on ${date}`;
      } else {
        recommendation = "reduce_active_zips_temporarily";
        recommendationReason = `${scheduledStops} scheduled stops exceed total capacity of ${totalStopCapacity} across ${availableTechnicians} technician(s) on ${date}`;
      }
    } else if (ratio >= 0.85) {
      demandPressure = "high";
      recommendation = "rebalance_routes";
      recommendationReason = `Scheduled stops (${scheduledStops}) are at ${Math.round(ratio * 100)}% of capacity (${totalStopCapacity}) on ${date}`;
    } else if (ratio >= 0.5) {
      demandPressure = "moderate";
      recommendation = "watch_demand";
      recommendationReason = `Scheduled stops (${scheduledStops}) are at ${Math.round(ratio * 100)}% of capacity (${totalStopCapacity}) on ${date}`;
    } else {
      demandPressure = "low";
      recommendation = "no_action_needed";
      recommendationReason = totalStopCapacity === 0
        ? `No technician capacity configured for ${date}`
        : `Scheduled stops (${scheduledStops}) are well under capacity (${totalStopCapacity}) on ${date}`;
    }

    return {
      date,
      available_technicians: availableTechnicians,
      total_stop_capacity: totalStopCapacity,
      scheduled_stops: scheduledStops,
      remaining_capacity: remainingCapacity,
      demand_pressure: demandPressure,
      recommendation,
      recommendation_reason: recommendationReason,
    };
  });

  // ─── Territory Staffing ─────────────────────────────────────────────────
  const { data: serviceAreas } = await db.from("service_areas").select("id, county, is_active");
  const serviceAreaCountyById = new Map<string, string>();
  (serviceAreas ?? []).forEach((sa: any) => { if (sa.county) serviceAreaCountyById.set(sa.id, sa.county); });

  const technicianCoverageByCounty = new Map<string, Set<string>>();
  for (const emp of activeEmployees) {
    const counties = new Set<string>();
    for (const saId of emp.service_area_ids ?? []) {
      const county = serviceAreaCountyById.get(saId);
      if (county) counties.add(county);
    }
    for (const county of counties) {
      if (!technicianCoverageByCounty.has(county)) technicianCoverageByCounty.set(county, new Set());
      technicianCoverageByCounty.get(county)!.add(emp.id);
    }
  }

  const territoryData = await getTerritoryIntelligence({ dateFrom: filters.dateFrom, dateTo: filters.dateTo });

  const territoryStaffing: TerritoryStaffingRow[] = territoryData.counties
    .filter((c) => c.county !== "Unknown")
    .map((c) => {
      const appointmentDemand = c.appointment_count;
      const technicianCoverage = technicianCoverageByCounty.get(c.county)?.size ?? 0;

      let overloadRisk: TerritoryStaffingRow["overload_risk"];
      let recommendation: WorkforceRecommendation;
      let recommendationReason: string;

      if (technicianCoverage === 0 && appointmentDemand > 0) {
        overloadRisk = "high";
        recommendation = "add_coverage_in_county";
        recommendationReason = `${appointmentDemand} appointment(s) in this county with zero technicians assigned coverage here`;
      } else if (technicianCoverage > 0 && appointmentDemand / technicianCoverage > 10) {
        overloadRisk = "high";
        recommendation = "add_technician";
        recommendationReason = `${appointmentDemand} appointments across only ${technicianCoverage} technician(s) covering this county`;
      } else if (technicianCoverage > 0 && appointmentDemand / technicianCoverage > 5) {
        overloadRisk = "moderate";
        recommendation = "watch_demand";
        recommendationReason = `${appointmentDemand} appointments across ${technicianCoverage} technician(s) — approaching a heavy load`;
      } else {
        overloadRisk = "low";
        recommendation = "no_action_needed";
        recommendationReason = technicianCoverage === 0
          ? "No demand and no technician coverage configured for this county"
          : `${appointmentDemand} appointments across ${technicianCoverage} technician(s) — manageable load`;
      }

      return {
        county: c.county,
        appointment_demand: appointmentDemand,
        technician_coverage: technicianCoverage,
        active_service_zips: c.active_zip_count,
        overload_risk: overloadRisk,
        recommendation,
        recommendation_reason: recommendationReason,
      };
    })
    .sort((a, b) => b.appointment_demand - a.appointment_demand);

  return {
    technician_utilization: technicianUtilization,
    capacity_forecast: capacityForecast,
    territory_staffing: territoryStaffing,
    generated_at: new Date().toISOString(),
    forecast_window: { from: dateFrom, to: dateTo },
  };
}
