import { calculateDistance, GeoLocation } from "../../lib/routeOptimization";
import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const db = supabaseAdmin ?? supabase;

export interface SmartStop {
  assignmentId: string;
  appointmentId: string;
  address: string;
  geo?: GeoLocation;
  estimatedServiceMinutes: number;
  isMockGeo: boolean;
}

export interface SmartRouteStop extends SmartStop {
  sequenceNumber: number;
  arrivalEta: string;
  departureEta: string;
  distanceFromPrevMiles: number;
  driveMinutesFromPrev: number;
  exceedsDriveCap: boolean;
}

export interface SmartOptimizeResult {
  stops: SmartRouteStop[];
  totalDistanceMiles: number;
  totalDriveMinutes: number;
  totalServiceMinutes: number;
  exceedsDriveCap: boolean;
  driveCapExceededAtStopIndex?: number;
  algorithmVersion: "smart-nearest-neighbor-v1";
  improvement: {
    distanceSavedMiles: number;
    timeSavedMinutes: number;
    percentImprovement: number;
  };
}

export interface SmartOptimizeInput {
  stops: SmartStop[];
  depotGeo?: GeoLocation;
  startTime: Date;
  maxDriveMinutes?: number;
}

/** Three-tier speed model: surface street / arterial / freeway */
function estimateDriveMinutes(distanceMiles: number): number {
  if (distanceMiles < 5) return (distanceMiles / 20) * 60;
  if (distanceMiles < 20) return (distanceMiles / 35) * 60;
  return (distanceMiles / 50) * 60;
}

function buildRouteStops(
  ordered: SmartStop[],
  startTime: Date,
  originGeo: GeoLocation | undefined,
  maxDriveMinutes: number | undefined
): { stops: SmartRouteStop[]; totalDistanceMiles: number; totalDriveMinutes: number; totalServiceMinutes: number; exceedsDriveCap: boolean; driveCapExceededAtStopIndex?: number } {
  const result: SmartRouteStop[] = [];
  let currentTime = new Date(startTime);
  let prevGeo = originGeo;
  let totalDistanceMiles = 0;
  let totalDriveMinutes = 0;
  let totalServiceMinutes = 0;
  let exceedsDriveCap = false;
  let driveCapExceededAtStopIndex: number | undefined;

  for (let i = 0; i < ordered.length; i++) {
    const stop = ordered[i];
    let distFromPrev = 0;
    let driveMin = 0;

    if (prevGeo && stop.geo) {
      distFromPrev = calculateDistance(prevGeo, stop.geo);
      driveMin = estimateDriveMinutes(distFromPrev);
    } else if (!prevGeo && i === 0) {
      driveMin = 5; // minimum dead-head when no depot known
    } else {
      driveMin = 5; // minimum between stops with no geo
    }

    totalDistanceMiles += distFromPrev;
    totalDriveMinutes += driveMin;
    totalServiceMinutes += stop.estimatedServiceMinutes;

    const capExceeded =
      maxDriveMinutes !== undefined && totalDriveMinutes > maxDriveMinutes;
    if (capExceeded && !exceedsDriveCap) {
      exceedsDriveCap = true;
      driveCapExceededAtStopIndex = i;
    }

    currentTime = new Date(currentTime.getTime() + driveMin * 60000);
    const arrivalEta = new Date(currentTime);
    currentTime = new Date(
      currentTime.getTime() + stop.estimatedServiceMinutes * 60000
    );
    const departureEta = new Date(currentTime);

    result.push({
      ...stop,
      sequenceNumber: i + 1,
      arrivalEta: arrivalEta.toISOString(),
      departureEta: departureEta.toISOString(),
      distanceFromPrevMiles: distFromPrev,
      driveMinutesFromPrev: driveMin,
      exceedsDriveCap: capExceeded,
    });

    prevGeo = stop.geo ?? prevGeo;
  }

  return {
    stops: result,
    totalDistanceMiles,
    totalDriveMinutes,
    totalServiceMinutes,
    exceedsDriveCap,
    driveCapExceededAtStopIndex,
  };
}

function nearestNeighborOrder(
  stops: SmartStop[],
  depotGeo: GeoLocation | undefined
): SmartStop[] {
  if (stops.length === 0) return [];

  const remaining = [...stops];
  const ordered: SmartStop[] = [];
  let currentGeo = depotGeo;

  while (remaining.length > 0) {
    if (!currentGeo) {
      // No geo reference — take first remaining and continue
      const next = remaining.shift()!;
      ordered.push(next);
      currentGeo = next.geo;
      continue;
    }

    let closestIdx = 0;
    let closestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist =
        remaining[i].geo
          ? calculateDistance(currentGeo, remaining[i].geo!)
          : Infinity;
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    const next = remaining.splice(closestIdx, 1)[0];
    ordered.push(next);
    currentGeo = next.geo ?? currentGeo;
  }

  return ordered;
}

export function smartOptimizeRoute(input: SmartOptimizeInput): SmartOptimizeResult {
  const { stops, depotGeo, startTime, maxDriveMinutes } = input;

  if (stops.length === 0) {
    return {
      stops: [],
      totalDistanceMiles: 0,
      totalDriveMinutes: 0,
      totalServiceMinutes: 0,
      exceedsDriveCap: false,
      algorithmVersion: "smart-nearest-neighbor-v1",
      improvement: { distanceSavedMiles: 0, timeSavedMinutes: 0, percentImprovement: 0 },
    };
  }

  // Compute original ordering cost for improvement delta
  const originalStats = buildRouteStops(stops, startTime, depotGeo, undefined);

  // Compute optimized ordering
  const ordered = nearestNeighborOrder(stops, depotGeo);
  const optimizedStats = buildRouteStops(ordered, startTime, depotGeo, maxDriveMinutes);

  const distanceSaved = Math.max(
    0,
    originalStats.totalDistanceMiles - optimizedStats.totalDistanceMiles
  );
  const timeSaved = Math.max(
    0,
    originalStats.totalDriveMinutes - optimizedStats.totalDriveMinutes
  );
  const pctImprovement =
    originalStats.totalDistanceMiles > 0
      ? (distanceSaved / originalStats.totalDistanceMiles) * 100
      : 0;

  return {
    ...optimizedStats,
    algorithmVersion: "smart-nearest-neighbor-v1",
    improvement: {
      distanceSavedMiles: Math.round(distanceSaved * 10) / 10,
      timeSavedMinutes: Math.round(timeSaved),
      percentImprovement: Math.round(pctImprovement * 10) / 10,
    },
  };
}

export interface ApplySmartOptimizeResult {
  success: boolean;
  reason?: string;
  improvement?: SmartOptimizeResult["improvement"];
}

/**
 * Fetches a route's stops, runs smartOptimizeRoute, and writes the new order
 * back — the exact logic POST /api/admin/routes/:routeId/reorder-stops uses
 * for a manual "Apply" click, extracted here so the Platform Growth Phase 2
 * auto-optimize sweep (routeAutomationPolicy.ts) can reuse it on freshly
 * auto-generated draft routes. Only acts on draft/approved routes, same as
 * the manual endpoint's guard.
 */
export async function applySmartOptimizeToRoute(
  routeId: string,
  actorId: string | null,
  actorRole: "admin" | "system",
): Promise<ApplySmartOptimizeResult> {
  const { data: route } = await db
    .from("routes")
    .select("id, status, employee_id, date")
    .eq("id", routeId)
    .maybeSingle();

  if (!route) return { success: false, reason: "route_not_found" };
  if (!["draft", "approved"].includes((route as any).status)) {
    return { success: false, reason: "not_draft_or_approved" };
  }

  const { data: stops } = await db
    .from("route_stops")
    .select("id, assignment_id, estimated_duration_minutes, sequence_number")
    .eq("route_id", routeId)
    .order("sequence_number");

  const orderedStops = stops ?? [];
  if (orderedStops.length === 0) return { success: false, reason: "no_stops" };

  const assignmentIds = orderedStops.map((s: any) => s.assignment_id);
  const { data: assignments } = await db
    .from("assignments")
    .select("id, appointments!inner(property_id)")
    .in("id", assignmentIds);

  const propIds = [
    ...new Set((assignments || []).map((a: any) => a.appointments?.property_id).filter(Boolean)),
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
    .eq("employee_id", (route as any).employee_id)
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

  const startTime = new Date(`${(route as any).date}T08:00:00`);
  const result = smartOptimizeRoute({
    stops: smartStops,
    depotGeo,
    startTime,
    maxDriveMinutes: capProfile?.max_drive_minutes_per_day ?? undefined,
  });

  const updates = result.stops.map((rs, i) => {
    const stop = orderedStops[i] as any;
    return db.from("route_stops").update({
      sequence_number: rs.sequenceNumber,
      arrival_eta: rs.arrivalEta,
      departure_eta: rs.departureEta,
      distance_from_prev_miles: rs.distanceFromPrevMiles,
      duration_from_prev_minutes: Math.round(rs.driveMinutesFromPrev),
    }).eq("id", stop.id);
  });
  await Promise.all(updates);

  await db.from("routes").update({
    total_distance_miles: Math.round(result.totalDistanceMiles * 10) / 10,
    total_duration_minutes: Math.round(result.totalDriveMinutes + result.totalServiceMinutes),
    algorithm_version: result.algorithmVersion,
  }).eq("id", routeId);

  await db.from("route_audit_log").insert({
    route_id: routeId,
    actor_id: actorId,
    actor_role: actorRole,
    action: actorRole === "system" ? "automation_smart_reorder" : "smart_reorder",
    metadata: {
      stop_count: result.stops.length,
      distance_saved_miles: result.improvement.distanceSavedMiles,
      time_saved_minutes: result.improvement.timeSavedMinutes,
      depot_geo_used: !!depotGeo,
    },
  });

  return { success: true, improvement: result.improvement };
}
