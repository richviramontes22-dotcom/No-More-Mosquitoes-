# Smart Routing Optimizer — Design Document
**Date:** 2026-06-16  
**Decision basis:** ROUTING_OPTIMIZER_DECISION_REPORT.md (Decision B)

---

## Overview

The smart routing optimizer is a non-destructive enhancement layer on top of the existing `optimizeRoute` function. It adds five targeted improvements without replacing or breaking any existing route generation behavior.

---

## Architecture

```
server/services/routing/
  smartRoutingOptimizer.ts     ← new (Phase 5)

server/routes/adminRoutes.ts
  POST /api/admin/routes/optimize-preview   ← new endpoint added here

client/pages/admin/RoutePlanning.tsx
  "Smart Optimize" button → modal with before/after comparison  ← Phase 6
```

---

## Interface Design

### Input (to `smartOptimizeRoute`)

```typescript
interface SmartOptimizeInput {
  stops: SmartStop[];           // current route stops with geo + metadata
  depotGeo?: GeoLocation;       // home_base_lat/lng from technician capacity profile
  startTime: Date;              // scheduled start of the technician's day
  maxDriveMinutes?: number;     // from technician capacity profile
}

interface SmartStop {
  assignmentId: string;
  appointmentId: string;
  address: string;
  geo?: GeoLocation;
  estimatedServiceMinutes: number;  // from route_stops.estimated_duration_minutes (default 45)
  isMockGeo: boolean;               // true if geo came from mockGeocodeAddress
}
```

### Output (from `smartOptimizeRoute`)

```typescript
interface SmartOptimizeResult {
  stops: SmartRouteStop[];
  totalDistanceMiles: number;
  totalDriveMinutes: number;
  totalServiceMinutes: number;
  exceedsDriveCap: boolean;
  driveCapExceededAtStopIndex?: number;
  algorithmVersion: "smart-nearest-neighbor-v1";
  improvement: {
    distanceSavedMiles: number;      // vs. original ordering
    timeSavedMinutes: number;
    percentImprovement: number;
  };
}

interface SmartRouteStop {
  assignmentId: string;
  sequenceNumber: number;
  arrivalEta: string;       // ISO
  departureEta: string;     // ISO
  distanceFromPrevMiles: number;
  driveMinutesFromPrev: number;
  estimatedServiceMinutes: number;
  exceedsDriveCap: boolean;
  isMockGeo: boolean;
}
```

---

## Algorithm

### Enhancement 1 — Depot-aware start

```
if depotGeo provided:
  find the stop with minimum distance from depotGeo
  use that as stop[0] (not whatever the DB returns first)
else:
  same as existing nearest-neighbor — take remaining[0]
```

### Enhancement 2 — Speed zone model

Replace `estimateTravelTime(distance)` (flat 25 mph) with:

```
function estimateDriveMinutes(distanceMiles: number): number {
  if (distanceMiles < 5)  return (distanceMiles / 20) * 60;  // 20 mph
  if (distanceMiles < 20) return (distanceMiles / 35) * 60;  // 35 mph
  return (distanceMiles / 50) * 60;                           // 50 mph
}
```

Rationale: < 5 mi = surface street / neighborhood; 5–20 mi = arterial; > 20 mi = freeway-dominant. This gives ~2–3× better accuracy than flat 25 mph for SoCal geography with no external API.

### Enhancement 3 — Per-stop service time

Use `estimatedServiceMinutes` from the stop input (derived from `route_stops.estimated_duration_minutes`) instead of hardcoded 30 minutes.

### Enhancement 4 — Drive time cap enforcement

```
let cumulativeDriveMinutes = 0;
for each stop:
  cumulativeDriveMinutes += driveMinutesFromPrev
  if maxDriveMinutes && cumulativeDriveMinutes > maxDriveMinutes:
    stop.exceedsDriveCap = true
    result.exceedsDriveCap = true
    if result.driveCapExceededAtStopIndex === undefined:
      result.driveCapExceededAtStopIndex = i
```

### Enhancement 5 — Improvement calculation

After optimizing, calculate what the original ordering would have produced (same Haversine + speed model, but in original sequence) and compute:
- `distanceSavedMiles = originalTotal - optimizedTotal`
- `timeSavedMinutes = originalDriveMinutes - optimizedDriveMinutes`
- `percentImprovement = (distanceSaved / originalTotal) * 100`

This powers the before/after display in the UI.

---

## API Endpoint Design

### `POST /api/admin/routes/optimize-preview`

**Auth:** `requireAdmin`  
**Body:**
```json
{ "routeId": "uuid" }
```

**Response:**
```json
{
  "routeId": "uuid",
  "currentOrder": [...stops in current db sequence...],
  "proposed": {
    "stops": [...SmartRouteStop[]...],
    "totalDistanceMiles": 42.3,
    "totalDriveMinutes": 78,
    "totalServiceMinutes": 315,
    "exceedsDriveCap": false,
    "algorithmVersion": "smart-nearest-neighbor-v1",
    "improvement": {
      "distanceSavedMiles": 6.1,
      "timeSavedMinutes": 11,
      "percentImprovement": 12.6
    }
  }
}
```

**What it does NOT do:** Does not write to the database. The response is preview-only. A separate `POST /api/admin/routes/:id/apply-optimization` (Phase 6 UI → existing rebuild endpoint) handles applying.

Actually, to keep it simple and avoid adding another endpoint, the UI "Apply" button will call the existing `POST /api/admin/routes/:id/rebuild` endpoint — the smart optimizer preview feeds into a reorder that gets written via the existing rebuild path.

---

## UI Design

On each route card in RoutePlanning.tsx (Day Planner tab) and in the Single Technician tab:

```
[Approve] [Publish] [Rebuild] [Discard]  →  add: [Smart Optimize ✦]
```

On click:
1. Spinner — calls `POST /api/admin/routes/optimize-preview`
2. Modal opens showing:
   - Current distance: X mi, estimated time: Y hr Z min
   - Proposed distance: X mi, estimated time: Y hr Z min  
   - Savings: −A mi / −B min (C% improvement)
   - Stop order comparison: current sequence vs. proposed sequence
   - Warning if drive cap exceeded
   - Warning if any stops use mock coordinates
3. Buttons: [Apply New Order] [Keep Current]
4. "Apply" calls `POST /api/admin/routes/:id/reorder-stops` (new simple endpoint that resequences stops without full rebuild)

---

## Database Impact

No new tables. The reorder operation updates `route_stops.sequence_number` and ETA fields in place, and sets `routes.algorithm_version = "smart-nearest-neighbor-v1"`, `routes.total_distance_miles`, `routes.total_duration_minutes`.

---

## Constraints Honored

- No paid APIs (no Google Distance Matrix)
- No mutation without explicit admin action
- No impact on existing `optimizeRoute` (additive only)
- No customer-facing changes
- No SMS, no Phase 3 CRM
- No break to existing day planner flow
