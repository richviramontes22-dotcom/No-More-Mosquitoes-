import { calculateDistance, GeoLocation } from "../../lib/routeOptimization";

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
