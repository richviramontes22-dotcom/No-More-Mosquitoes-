# Phase 8 — Routing System Design Report
**Date:** 2026-05-31
**Project:** No More Mosquitoes — Employee Operations Sprint

---

## Current Routing State

The database has `routes` and `route_stops` tables. Zero code references them. The routing feature is **completely unimplemented** despite the DB schema existing.

```sql
-- What exists in DB (never used):
routes: id, route_date, employee_id, name, status, notes
route_stops: id, route_id, assignment_id, seq, eta, status
```

---

## Routing Modes

### Mode A: Proposal Mode (Required for Beta)
Admin generates a route proposal → reviews it → approves → employees are notified.

Flow:
1. Admin opens Route Planner in admin dashboard
2. Selects date
3. Clicks "Generate Route Proposal"
4. System runs MVP algorithm (see below)
5. Admin sees proposed assignments per technician in suggested order
6. Admin can drag to reorder, reassign to different tech, or remove stops
7. Admin clicks "Approve & Publish Route"
8. Employees are notified via in-app notification (and optionally email/SMS)
9. Route is locked — no changes without admin edit

### Mode B: Auto-Route Mode (Post-Beta)
System automatically assigns and sequences routes based on configuration.
Not recommended for initial launch — requires more validation of algorithm and customer schedules.

---

## MVP Algorithm

The MVP algorithm is intentionally simple. It does NOT require AI, external routing APIs, or complex optimization.

### Inputs
```typescript
interface RoutingInput {
  date: string;               // YYYY-MM-DD
  appointments: Array<{
    id: string;
    property_id: string;
    lat: number | null;
    lng: number | null;
    address: string;
    city: string;
    zip: string;
    scheduled_at: string;     // time window requested
    service_type: string;
    estimated_duration_minutes: number; // default: 45
    priority: 'normal' | 'vip' | 'overdue';
  }>;
  technicians: Array<{
    id: string;
    name: string;
    status: 'active';
    capacity: number;         // max stops per day, default: 8
    start_location?: { lat: number; lng: number };
    default_nav: 'google' | 'apple';
  }>;
}
```

### Algorithm Steps

**Step 1: Filter eligible appointments**
- Date matches route_date
- Status = 'scheduled' (not yet assigned)
- Not already on an approved route

**Step 2: Group by service area (ZIP code)**
- Group appointments by ZIP code
- Nearby ZIPs cluster together using a simple neighbor map (admin-configurable)

**Step 3: Sort within each group**
- Priority first: overdue → vip → normal
- Then by requested time window (earliest first)

**Step 4: Assign to technicians**
- Distribute groups to available technicians
- Respect capacity limits (default 8 stops/technician/day)
- Try to give one ZIP cluster to one technician to minimize drive time
- If more stops than capacity allows, flag overflow

**Step 5: Estimate travel time**
If lat/lng available for all stops:
- Calculate Haversine distances between consecutive stops
- Assume 30 mph average in service area → estimated minutes
- Accumulate to produce ETA per stop (starting from 8:00 AM or technician start time)

If lat/lng missing:
- Flag stop as "address-only" — ETA cannot be estimated
- Include in proposal with warning

**Step 6: Detect conflicts**
- Same technician assigned to overlapping time windows
- Capacity exceeded
- Missing lat/lng coordinates
- Appointments in ZIP codes outside service area polygon (if defined)

**Step 7: Produce proposal**
```typescript
interface RouteProposal {
  proposal_id: string;
  date: string;
  generated_at: string;
  algorithm_version: string;
  confidence: 'high' | 'medium' | 'low';
  unassigned_appointments: string[];    // ids of appointments that couldn't be placed
  technician_routes: Array<{
    technician_id: string;
    technician_name: string;
    stop_count: number;
    estimated_hours: number;
    confidence: 'high' | 'medium' | 'low';
    conflicts: string[];
    stops: Array<{
      seq: number;
      assignment_id: string | null;    // null if not yet created
      appointment_id: string;
      address: string;
      city: string;
      zip: string;
      lat: number | null;
      lng: number | null;
      priority: string;
      service_type: string;
      scheduled_at: string;
      estimated_arrival: string;       // ISO time
      estimated_duration_minutes: number;
      travel_from_prev_minutes: number;
    }>;
  }>;
}
```

---

## Routing Confidence Score

| Score | Condition |
|-------|-----------|
| High | All stops have lat/lng; no conflicts; capacity within limits |
| Medium | Some stops missing coordinates; minor overlap; capacity at 80%+ |
| Low | Many missing coordinates; conflicts present; capacity exceeded |

---

## Database Changes Required

The existing schema is sufficient. Changes needed:

```sql
-- Extend routes table
ALTER TABLE routes
  ADD COLUMN proposal_metadata jsonb,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN published_at timestamptz,
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN algorithm_version text DEFAULT 'mvp-v1',
  ADD COLUMN confidence text CHECK (confidence IN ('high', 'medium', 'low'));

-- Extend route_stops table
ALTER TABLE route_stops
  ADD COLUMN appointment_id uuid REFERENCES appointments(id),
  ADD COLUMN estimated_arrival timestamptz,
  ADD COLUMN travel_from_prev_minutes int,
  ADD COLUMN estimated_duration_minutes int DEFAULT 45;
```

---

## Server Routes Required

```
POST /api/admin/routes/generate     — run algorithm, return proposal (not yet saved)
POST /api/admin/routes              — save proposal as draft
GET  /api/admin/routes              — list routes by date
GET  /api/admin/routes/:id          — route detail with stops
PATCH /api/admin/routes/:id/stops   — reorder or reassign stops
POST /api/admin/routes/:id/approve  — approve route, create assignments, notify employees
POST /api/admin/routes/:id/publish  — publish (notify employees)
POST /api/admin/routes/:id/lock     — lock route (no more changes)
GET  /api/employee/routes/today     — employee's route for today
```

---

## What Should NOT Be Built Yet

- Real-time traffic integration (Google Maps Distance Matrix API, etc.)
- AI-based optimization (TSP solvers, ML models)
- Multi-day route planning
- Automatic appointment creation + routing in one step
- Autonomous dispatching without admin review
- Complex priority scoring formulas

These are valid future features. They require more data, more testing, and more operational confidence before they should be trusted to run automatically.

---

## Coordinate Data Gap

A critical dependency: routing requires lat/lng for all appointment properties. Currently:
- `properties` table has `lat` and `lng` columns
- The Regrid API integration can geocode parcel coordinates from address
- Not all properties may have coordinates populated

**Before routing can be useful:**
1. Audit what fraction of `properties` rows have lat/lng
2. Backfill missing coordinates via Regrid or Google Geocoding API
3. Show "Missing coordinates" warning in route proposal for any stop that can't be geolocated

---

## External API Option (Optional Enhancement)

After MVP algorithm is validated, optionally add:
- **Google Maps Distance Matrix API** — real drive time between each pair of stops (~$5-10/1000 requests)
- **OpenRouteService** — free, open-source routing API
- Route these requests through a server-side cache to avoid redundant calls

Neither is required for MVP. Haversine distance estimates are sufficient to get started.
