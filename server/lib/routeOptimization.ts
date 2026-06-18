/**
 * Route Optimization Utility
 * Implements nearest-neighbor algorithm for optimizing delivery routes
 */

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface AssignmentForRouting {
  id: string;
  appointment_id: string;
  employee_id: string;
  status: string;
  property?: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  geo?: GeoLocation;
  started_at?: string | null;
  completed_at?: string | null;
}

/**
 * Calculate simple Haversine distance between two geographic points (in miles)
 * This is a basic implementation suitable for MVP.
 * For production, integrate Google Maps Distance Matrix API for real travel times.
 */
export function calculateDistance(from: GeoLocation, to: GeoLocation): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
    Math.cos(toRad(to.latitude)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Estimate travel time between two points (in minutes)
 * MVP: Uses simple speed assumption (25 mph average)
 * Production: Integrate Google Maps Distance Matrix API
 */
export function estimateTravelTime(distance: number): number {
  const avgSpeedMph = 25; // Average speed assumption for MVP
  return (distance / avgSpeedMph) * 60; // Convert to minutes
}

export interface RouteStop {
  assignment: AssignmentForRouting;
  sequenceNumber: number;
  distanceFromPrevious: number;
  durationFromPrevious: number;
  arrivalEta: string; // ISO timestamp
  departureEta: string; // ISO timestamp
}

/**
 * Optimize assignments using nearest-neighbor algorithm
 * Returns assignments sorted by proximity for efficient routing
 *
 * Algorithm:
 * 1. Start with the first assignment (or starting location)
 * 2. Find the closest unvisited assignment
 * 3. Add it to the route and mark as visited
 * 4. Repeat until all assignments are visited
 */
export function optimizeRoute(
  assignments: AssignmentForRouting[],
  startTime: Date = new Date()
): RouteStop[] {
  if (assignments.length === 0) {
    return [];
  }

  // Filter out completed assignments
  const pending = assignments.filter((a) => a.status !== "completed");

  if (pending.length === 0) {
    return [];
  }

  // Start with the first pending assignment
  const optimized: AssignmentForRouting[] = [];
  const remaining = [...pending];
  let currentAssignment = remaining.shift()!;
  optimized.push(currentAssignment);

  // Greedy nearest-neighbor: at each step, pick the closest unvisited assignment
  while (remaining.length > 0) {
    let closestIdx = 0;
    let closestDistance = Infinity;

    // Find the nearest assignment from current position
    for (let i = 0; i < remaining.length; i++) {
      const distance =
        currentAssignment.geo && remaining[i].geo
          ? calculateDistance(currentAssignment.geo, remaining[i].geo)
          : Infinity;

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIdx = i;
      }
    }

    currentAssignment = remaining.splice(closestIdx, 1)[0];
    optimized.push(currentAssignment);
  }

  // Convert to RouteStop objects with ETA calculations
  const routeStops: RouteStop[] = [];
  let currentTime = new Date(startTime);
  let previousGeo: GeoLocation | null = null;

  for (let i = 0; i < optimized.length; i++) {
    const assignment = optimized[i];

    // Calculate distance from previous stop
    let distance = 0;
    let duration = 0;

    if (previousGeo && assignment.geo) {
      distance = calculateDistance(previousGeo, assignment.geo);
      duration = estimateTravelTime(distance);
    }

    // Add travel time to current time for arrival ETA
    const travelTime = duration > 0 ? duration : 5; // Minimum 5 minutes
    currentTime = new Date(currentTime.getTime() + travelTime * 60000);

    const arrivalEta = new Date(currentTime);
    // Assume 30 minutes service time at each stop
    const departureEta = new Date(currentTime.getTime() + 30 * 60000);

    routeStops.push({
      assignment,
      sequenceNumber: i + 1,
      distanceFromPrevious: distance,
      durationFromPrevious: duration,
      arrivalEta: arrivalEta.toISOString(),
      departureEta: departureEta.toISOString(),
    });

    currentTime = departureEta;
    previousGeo = assignment.geo || null;
  }

  return routeStops;
}

// ─── Coordinate resolution + confidence scoring ──────────────────────────────
// Shared by server/routes/adminRoutes.ts (single-tech + day-plan generation)
// and server/services/routing/dayPlanGenerator.ts (automated day-plan generation)
// — moved here so both call sites use one implementation.

export type CoordSource = "property_coordinates" | "mock_fallback";

export interface ResolvedCoord {
  latitude: number;
  longitude: number;
  source: CoordSource;
}

export function mockGeocodeAddress(address: string, zip: string): { latitude: number; longitude: number } {
  const zipHash = (zip || "90000")
    .split("")
    .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
  return {
    latitude:  33.7 + (zipHash % 100) / 1000,
    longitude: -117.9 + (zipHash % 100) / 1000,
  };
}

export function resolveCoordinates(prop: any): ResolvedCoord {
  const lat = prop?.lat ?? prop?.latitude;
  const lng = prop?.lng ?? prop?.longitude;
  if (typeof lat === "number" && typeof lng === "number" && lat !== 0 && lng !== 0) {
    return { latitude: lat, longitude: lng, source: "property_coordinates" };
  }
  return { ...mockGeocodeAddress(prop?.address ?? "", prop?.zip ?? ""), source: "mock_fallback" };
}

export function calculateConfidence(
  totalStops: number,
  mockCount: number,
  conflictNotes: string[]
): "high" | "medium" | "low" {
  if (mockCount === 0 && conflictNotes.length === 0) return "high";
  if (mockCount <= 2 && conflictNotes.length <= 1) return "medium";
  return "low";
}

/**
 * Validate that assignments have required geo information
 */
export function validateAssignmentsForRouting(
  assignments: AssignmentForRouting[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  assignments.forEach((assignment, index) => {
    if (!assignment.geo) {
      errors.push(
        `Assignment ${index + 1} (${assignment.property?.address || assignment.id}) is missing geolocation data`
      );
    }

    if (!assignment.property) {
      errors.push(
        `Assignment ${index + 1} (${assignment.id}) is missing property information`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
