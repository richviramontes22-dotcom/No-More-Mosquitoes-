# ROUTING SYSTEM ARCHITECTURE
## No More Mosquitoes — Route Optimization Design
## Date: 2026-05-28
## Status: Design Only — No Implementation

---

## Existing Route-Related Infrastructure

### Current Tables in Migrations

Searching all migration files for routing-related tables:

- `db/migrations/2025-11-28_missing_tables.sql` — likely contains `routes` and `route_stops` (referenced by admin RoutePlanning UI)
- `db/migrations/2026-05-28_property_coordinates.sql` — adds `lat`/`lng` to `properties`
- `service_areas` table — exists (referenced by `business_hours`, `blackout_dates`, `availability`)

The `routes` and `route_stops` tables are referenced by `client/pages/admin/RoutePlanning.tsx` via routes `/api/admin/routes` and `/api/admin/routes/:id/stops/:stopId`. The server route `server/routes/adminRoutes.ts` exists. These tables are assumed to exist in Supabase based on the migration referenced, though they may not have a confirmed schema in the reviewed migration files.

### Current Property Coordinate State

`properties.lat` and `properties.lng` exist as `NUMERIC(10,7)` columns since `2026-05-28_property_coordinates.sql`. However, they are `NULL` for all properties until a geocoding backfill is run. No server-side code automatically populates these during booking.

### What the Route Planning UI Currently Does

`client/pages/admin/RoutePlanning.tsx` provides:
- Create/delete routes (`GET|POST /api/admin/routes`)
- Add/remove stops (`PATCH /api/admin/routes/:id/stops/:stopId`)
- No optimization algorithm — admin manually adds stops

This is Level 0 capability: a route builder with no algorithmic optimization.

---

## Level 1 — Simple Route Grouping

### Description
Group appointments by city or ZIP code. Assign each technician to a geographic area for the day. No coordinate math required.

### Data Requirements
- `appointments.scheduled_date` — which day
- `properties.city` or `properties.zip` — geographic grouping
- `assignments.employee_id` — which technician
- No `lat`/`lng` required

### Algorithm

```
For each service day:
  1. Query all appointments for that day with status = "scheduled".
  2. Group appointments by city/ZIP.
  3. List technicians available that day.
  4. Assign each city/ZIP group to one technician.
  5. If one technician: assign all. If multiple: distribute by job count.
```

### Implementation

1. Add a server endpoint `GET /api/admin/routes/suggestions?date=YYYY-MM-DD` that returns groupings.
2. Admin views groupings and confirms or adjusts technician assignments.
3. One click assigns all appointments in a group to the selected technician.

### New Tables/Columns Needed

None beyond what exists. Optionally add `appointments.route_group TEXT` to persist the group assignment.

### API Dependencies
None.

### Implementation Effort
**3–4 days**

### Limitations
- No travel time optimization.
- Large cities with many properties will not be optimal.
- Does not account for job duration or window constraints.

---

## Level 2 — Geographic Clustering

### Description
Use `lat`/`lng` coordinates to cluster nearby appointments. Minimize total distance within a day's route using nearest-neighbor heuristic.

### Data Requirements
- `properties.lat`, `properties.lng` — required (currently null until geocoded)
- `appointments.scheduled_date`, `window` — for time grouping
- `employees.id`, `employees.user_id` — technician identity
- Technician starting location (home or depot) — new: `employees.home_lat`, `employees.home_lng`

### Algorithm — Nearest Neighbor Greedy

```
Input: List of appointments with lat/lng for a given day and window.
Output: Ordered list of visits for one technician.

1. Start from technician's home location (or first job if home unknown).
2. Find the unvisited job closest to the current position (Haversine distance).
3. Add it to the route, move to that position.
4. Repeat until all jobs assigned.
5. Return ordered route.
```

**Distance formula (Haversine):**
```typescript
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
```

### Multi-Technician Distribution

```
1. Cluster appointments by geographic proximity (k-means or simple grid-based).
2. Assign each cluster to one technician.
3. Within each cluster, sort by nearest-neighbor.
4. If clusters are imbalanced, move boundary jobs between clusters.
```

### New Tables/Columns Needed

```sql
-- Add home location to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS home_lat NUMERIC(10,7);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS home_lng NUMERIC(10,7);

-- Persist daily route ordering
CREATE TABLE IF NOT EXISTS daily_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_date DATE NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  stop_order INTEGER NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### API Dependencies
None for distance calculation (pure math). Optionally call Google Maps Distance Matrix API for real road distances instead of straight-line.

### Implementation Effort
**5–7 days** (including geocoding backfill, algorithm implementation, admin UI update)

### Limitations
- Nearest-neighbor is not optimal (can be 20–25% worse than TSP).
- Does not respect appointment time windows.
- Straight-line distance ignores roads, traffic, bridges.
- Works only after lat/lng populated on properties.

---

## Level 3 — Advanced Route Optimization

### Description
Time-window constrained routing, multi-technician routing with capacity and time constraints, dynamic re-routing, optional integration with Google Maps Distance Matrix API for real road distances.

### Data Requirements
- All Level 2 data.
- `business_hours.windows` — arrival time windows per appointment.
- `employees.home_lat/lng` — depot location.
- Google Maps Distance Matrix API key — for real travel times.
- Appointment duration estimate (new: `service_plans.avg_duration_minutes`).

### Algorithm Options

**Option A: OR-Tools (Google, open source)**
- Solves Vehicle Routing Problem with Time Windows (VRPTW).
- Handles multiple vehicles (technicians) and time constraints.
- Would require a Python microservice or Node.js port.
- Produces optimal or near-optimal solutions.
- **Complexity:** Very high — separate service, complex integration.

**Option B: Christofides-like heuristic**
- Constructive heuristic: savings algorithm (Clarke-Wright).
- Works in Node.js without external service.
- Within 10% of optimal for typical cases.
- **Complexity:** High — significant algorithm implementation.

**Option C: Google Maps Directions API — route waypoints**
- Send all stops as waypoints to Google Maps.
- Google optimizes order via `optimize_waypoints=true`.
- Returns ordered waypoints + estimated arrival times.
- Costs approximately $10 per 1,000 requests.
- **Complexity:** Medium — API integration, not algorithm implementation.

### Dynamic Re-Routing

When a job is added or removed mid-day:
1. Get remaining incomplete jobs in the technician's route.
2. Get current technician position (GPS if available, else last completed job).
3. Re-run routing algorithm for remaining jobs.
4. Update `daily_routes` table.
5. Push updated route to technician portal.

### New Tables/Columns Needed

```sql
-- Service duration estimate on plans
ALTER TABLE service_plans ADD COLUMN IF NOT EXISTS avg_duration_minutes INTEGER DEFAULT 45;

-- Route with real travel estimates
ALTER TABLE daily_routes ADD COLUMN IF NOT EXISTS estimated_travel_minutes INTEGER;
ALTER TABLE daily_routes ADD COLUMN IF NOT EXISTS actual_arrival TIMESTAMPTZ;
ALTER TABLE daily_routes ADD COLUMN IF NOT EXISTS actual_departure TIMESTAMPTZ;

-- Technician shift tracking
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_start TIME DEFAULT '08:00';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_end TIME DEFAULT '17:00';
```

### API Dependencies
- Google Maps Distance Matrix API: `$10 per 1,000 requests` (estimated cost for small operation: under $50/month)
- OR-Tools: Open source, requires Python runtime
- Google Maps Directions API (Option C): `$10 per 1,000 requests`

### Implementation Effort
**15–25 days** depending on algorithm complexity and whether a microservice is used

### Limitations
- Requires GPS coordinates on all properties.
- Real-time re-routing requires live technician GPS.
- Google Maps API adds cost and external dependency.

---

## Recommendation: Which Level to Implement First

**Implement Level 1 immediately, Level 2 next sprint.**

### Rationale

**Level 1 — Simple Route Grouping (implement now):**
- Zero new infrastructure requirements.
- Works with current data (city/zip on properties).
- Provides immediate admin value: one-click assignment of all appointments in a zone to one technician.
- Replaces the current "admin manually assigns each one" workflow.
- 3–4 days of effort.

**Level 2 — Geographic Clustering (next sprint):**
- Requires geocoding properties (backfill already documented in migration).
- The nearest-neighbor algorithm is straightforward to implement.
- Reduces technician drive time by 15–30% compared to unoptimized assignment.
- Admin UI shows ordered route on a map.
- 5–7 days of effort after geocoding is complete.

**Level 3 — Advanced (post-beta):**
- Adds significant complexity and external API dependency.
- Only valuable when the operation has 3+ technicians and 10+ jobs per day.
- Defer until business volume justifies the investment.

### Prerequisite for Level 2: Geocoding

Before Level 2 routing is useful, `properties.lat` and `properties.lng` must be populated. Two paths:

1. **Backfill from parcel_lookup_cache** (documented in migration comments):
   ```sql
   UPDATE properties p
   SET lat = c.latitude, lng = c.longitude
   FROM parcel_lookup_cache c
   WHERE lower(trim(p.address)) = lower(trim(c.normalized_address))
     AND c.latitude IS NOT NULL AND p.lat IS NULL;
   ```

2. **Write during `confirm-booking`**: When Regrid or Google Geocoding resolves coordinates during parcel lookup, persist them to `properties.lat/lng`. This requires a small addition to `server/routes/billingStripe.ts` or `server/services/parcel/parcelLookupService.ts`.

---

## Implementation Roadmap

| Level | Effort | Dependencies | Value |
|-------|--------|--------------|-------|
| Level 1: ZIP/city grouping | 3–4 days | None | Immediate admin workflow improvement |
| Geocoding backfill | 1–2 days | `parcel_lookup_cache` or Google Geocoding API | Required for Level 2 |
| Level 2: Nearest-neighbor clustering | 5–7 days | Geocoded properties | 15–30% travel reduction |
| Level 3: VRPTW optimization | 15–25 days | Level 2 + Google Maps API | Optimal routing at scale |
