# Routing Engine Report
**Date:** 2026-05-31

## Summary

The routing engine already existed in `server/lib/routeOptimization.ts`. This sprint did not replace it — it connected it to the approve/publish lifecycle.

## Algorithm: Nearest-Neighbor

File: `server/lib/routeOptimization.ts`

**Input:** Array of `AssignmentForRouting` with coordinates
**Output:** Ordered array of `RouteStop` with ETAs

**Steps:**
1. Filter out already-completed assignments
2. Start with the first assignment as position 0
3. At each step: find the closest remaining unvisited assignment using Haversine distance
4. Add it as the next stop
5. Calculate ETA: travel time (distance/25mph) + 30 min service time per stop
6. Repeat until all assignments placed

**Distance formula:** Haversine (great-circle distance)
```typescript
export function calculateDistance(from: GeoLocation, to: GeoLocation): number {
  const R = 3959; // Earth's radius in miles
  // ... standard haversine implementation
}
```

**Speed assumption:** 25 mph average (suitable for suburban service areas)
**Service time per stop:** 30 minutes (hardcoded default)

## Geocoding

The current generate endpoint uses `mockGeocodeAddress()` — a ZIP-based hash that produces consistent but fake coordinates. This is intentionally temporary.

**Production path:**
1. Use `properties.lat` and `properties.lng` (already populated via Regrid for many properties)
2. Fall back to Google Geocoding API for missing coordinates
3. The generate endpoint should check properties for real coordinates first

Current implementation in `POST /api/admin/routes/generate`:
```typescript
geo: mockGeocodeAddress(a.appointments.properties.address, a.appointments.properties.zip)
```

**This means routes generated today use fake coordinates for optimization.** The sequence will be internally consistent (same ZIP → clustered), but may not be truly optimal until real coordinates are used.

## Algorithm Version Tracking

All routes are tagged `algorithm_version = 'nearest-neighbor-v1'`. When the algorithm is upgraded (e.g., real geocoding, 2-opt improvement), increment the version so reports can compare historical performance.

## Confidence Scoring

Not yet calculated — routes are stored without confidence field. Future: calculate confidence based on:
- % of stops with real coordinates vs mocked
- Whether all stops are in the same city/ZIP
- Capacity utilization
- Any detected conflicts

## Limitations

1. **Single-technician only:** Each route is per-employee. Multi-technician optimization (distributing stops across available technicians) is not yet implemented.
2. **No time windows:** Customer availability windows are not factored into the ordering — only proximity is used.
3. **No priority:** VIP or overdue appointments are not weighted differently.
4. **No traffic:** 25 mph flat assumption; no real-time traffic.
5. **Mock geocoding:** Real lat/lng from `properties` table should be used instead.

All of these are known limitations acceptable for beta.
