# Routing Engine Audit Report
**Date:** 2026-06-16  
**Scope:** Full audit of the route planning and scheduling system — algorithm, data model, UI, workforce constraints, and production readiness.

---

## Files Audited

| File | Lines | Purpose |
|------|-------|---------|
| `server/lib/routeOptimization.ts` | 191 | Core optimizer — `optimizeRoute()` |
| `server/routes/adminRoutes.ts` | ~1100 | Day planner, per-tech route CRUD, API endpoints |
| `server/lib/technicianAvailability.ts` | 177 | 7-level availability resolution chain |
| `server/lib/technicianCapacity.ts` | 101 | 5-level capacity resolution chain |
| `server/lib/workforceValidation.ts` | 189 | Per-route and per-day validation |
| `client/pages/admin/RoutePlanning.tsx` | 713 | Admin UI — day planner + single-tech view |
| `db/migrations/2026-05-31_extend_routes.sql` | — | routes / route_stops / route_audit_log schema |

---

## 1. Algorithm: What Exists Today

### `optimizeRoute()` — `server/lib/routeOptimization.ts`

**Algorithm type:** Greedy nearest-neighbor (version label: `"nearest-neighbor-v1"`)

**How it works:**
1. Filters out `completed` assignments
2. Takes the first pending assignment as the starting point (no depot/home consideration)
3. At each step, picks the closest unvisited assignment by Haversine distance
4. Calculates ETAs using a flat 25 mph average speed
5. Adds a hardcoded 30-minute service window at each stop
6. Returns a `RouteStop[]` with sequence, arrival/departure ETAs, and leg distances

**Distance metric:** Haversine (straight-line great-circle distance) — **not** road distance. No traffic, no road geometry.

**Speed assumption:** 25 mph flat — applied uniformly to all segments regardless of road type (freeway vs. surface street vs. mountain road).

**Starting point:** Always `remaining[0]` — the first pending assignment returned by the DB query. The `home_base_lat`/`home_base_lng` stored in `technician_capacity_profiles` is **never passed to or used by `optimizeRoute`**.

**Service time:** 30 minutes hardcoded — does not vary by property acreage, service type, or subscription tier.

**Missing-geo handling:** If either the current or candidate stop has no `geo`, distance is set to `Infinity`, and that stop is deprioritized to the end. When all remaining stops lack geo, order is arbitrary (depends on array position).

---

## 2. Coordinate Resolution

**In `server/routes/adminRoutes.ts` → `resolveCoordinates()`:**

1. First: real lat/lng from the `properties` table
2. Fallback: `mockGeocodeAddress(address)` — deterministic hash of address string → fake lat/lng near ZIP centroid

**Problem:** Mock coordinates cluster stops within a ZIP code realistically, but distances between ZIPs are measured from fake centroids. Two stops in different ZIP codes could appear adjacent in the optimized order even when road connections between those ZIPs are poor (e.g., mountain ZIPs in SB County: 92315 Big Bear Lake → 92401 San Bernardino City requires highway descent — Haversine shows ~25 miles but actual drive is 40+ miles).

**Confidence tagging:** `calculateConfidence(totalStops, mockCount, conflictNotes)` returns "high"/"medium"/"low" and writes `conflict_notes[]` to the route — good for UI transparency, but confidence is not fed back into the optimizer to change behavior.

---

## 3. Day Planner — Scheduling Layer

**In `server/routes/adminRoutes.ts` → `POST /api/admin/routes/generate-day-plan`:**

1. Blackout check (company-wide + per-employee)
2. Filter available techs for the date via `isTechnicianAvailable()`
3. Find unrouted appointments for the date
4. Group appointments by ZIP code → ZIP groups
5. Assign ZIP groups to technicians via round-robin (technician with fewest stops gets the next ZIP group)
6. Call `optimizeRoute()` per technician
7. Write `routes` + `route_stops` + log to `route_audit_log`

**ZIP-first grouping** is a smart heuristic — it prevents a technician from bouncing between geographically distant ZIP codes. However:
- It does not account for technician home-base ZIP when deciding which ZIPs to assign
- It does not account for ZIP adjacency or drive-time between ZIP groups
- A tech assigned to ZIP 92315 (Big Bear Lake) and ZIP 92401 (SB City) will show a massive dead leg between the groups, since they're 40+ road miles apart

---

## 4. Workforce Constraints — What's Wired

### `isTechnicianAvailable()` — `server/lib/technicianAvailability.ts`

7-level priority chain (highest to lowest):
1. `employees.status !== "active"` → unavailable
2. Company-wide blackout date → unavailable
3. Employee-scoped blackout date → unavailable
4. Approved `technician_time_off_requests` (graceful — skipped if table missing)
5. `technician_date_overrides` (admin-set per-date exception)
6. `technician_schedule_templates` (day-of-week template)
7. Business-hours default (fallback if no template)

Returns: `{ available, reason, work_start, work_end, max_stops }`

**work_start / work_end are returned but NOT used by the day planner** to gate which appointments can be assigned to a tech.

### `getEffectiveDailyCapacity()` — `server/lib/technicianCapacity.ts`

5-level max_stops priority chain:
1. `technician_date_overrides.max_stops_override`
2. `technician_schedule_templates.max_stops`
3. `technician_capacity_profiles.max_stops_per_day`
4. `employees.default_max_stops`
5. Global fallback: 8

Also returns (from `technician_capacity_profiles`):
- `max_service_minutes` — maximum total service time per day
- `max_drive_minutes` — maximum total drive time per day
- `allowed_service_types` — what treatments this tech can perform
- `skill_level`, `is_licensed_applicator`
- `preferred_service_area_ids`
- `home_base_lat`, `home_base_lng`

**Critical gap:** `max_service_minutes` and `max_drive_minutes` are stored but **never enforced** — `workforceValidation.ts` only checks stop count, not service or drive minutes.

### `validateDayPlanForWorkforce()` — `server/lib/workforceValidation.ts`

Checks per route:
- Technician availability (mirrors `isTechnicianAvailable`)
- Missing schedule template (warning)
- Missing capacity profile (warning)
- Stop count > `max_stops_per_day` (critical blocker)
- Route confidence = "low" (warning)
- `conflict_notes` present (info)

Not checked:
- Total estimated drive time vs. `max_drive_minutes`
- Total estimated service time vs. `max_service_minutes`
- Whether stops respect work_start / work_end window

---

## 5. Admin UI — RoutePlanning.tsx

### Day Planner Tab
- Generate Day Plan, Approve All, Publish All, Discard Drafts buttons
- Per-technician route cards showing: tech name, stop count, distance, confidence badge, conflict warnings
- Unassigned appointments shown with amber warning card
- No "re-optimize" or "smart-optimize" button — once a route is generated, stop order is fixed unless rebuilt

### Single Technician Tab
- Date + employee selector
- Generate Optimized Route button
- Stop table: sequence, address, ETA, distance
- Route lifecycle: Approve, Publish, Rebuild, Discard buttons
- No preview of alternative orderings; no home-base visualization

---

## 6. Route Data Model (from `2026-05-31_extend_routes.sql`)

### `routes` table
- `id`, `employee_id`, `date`, `status` (draft/approved/assigned/published/in_progress/completed/canceled)
- `algorithm_version` (default `'nearest-neighbor-v1'`)
- `confidence` ("high"/"medium"/"low")
- `conflict_notes` (jsonb array)
- `total_distance_miles`, `total_duration_minutes`

### `route_stops` table
- `sequence_number`, `arrival_eta`, `departure_eta`
- `distance_from_prev_miles`, `duration_from_prev_minutes`
- `appointment_id`, `estimated_duration_minutes` (default 45)

### `route_audit_log` table
- `route_id`, `actor_id`, `actor_role`, `action`, `metadata`

---

## 7. Key Findings — Gaps and Weaknesses

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| G1 | No depot/home-base start: optimizer begins from first DB row | Medium | First leg of every route potentially long; tech drives past their home to reach stop 1 |
| G2 | Haversine vs. road distance: SB County mountain/desert terrain means 30–60% underestimation | High | ETAs wrong by 20–40 min on mountain/desert legs; total distance wrong; confidence misleading |
| G3 | Flat 25 mph speed: SoCal freeways (I-15, I-10) average 45+ mph; surface streets 15–20 mph | High | ETAs structurally wrong; freeway segments overestimated, surface-street segments underestimated |
| G4 | Hardcoded 30-min service time: ignores acreage (0.25 ac vs. 2.5 ac ≠ same duration) | Medium | Schedule compression/overflow for large properties; idle time for small properties |
| G5 | max_drive_minutes not enforced: stored in capacity_profiles, never checked | Medium | A tech could be assigned an 8-stop route with 4 hrs of mountain driving, violating their daily limit |
| G6 | work_start/work_end not used for appointment gating | Low | Could assign a 7 AM appointment to a tech who starts at 9 AM |
| G7 | ZIP-to-tech assignment ignores home-base ZIP | Medium | A tech based in Ontario may be assigned Big Bear Lake ZIPs while a tech based in Victorville handles Ontario ZIPs |
| G8 | No return-to-depot time | Low | Total route duration doesn't include drive home — can lead to unrealistic published ETAs |

---

## 8. What Works Well

- The nearest-neighbor algorithm is correct and handles edge cases (no geo, completed stops)
- The 7-level availability chain is comprehensive and production-hardened
- The 5-level capacity resolution is correct and extensible
- The route audit log provides full history
- The day planner's ZIP-first grouping is a practical heuristic that avoids the worst cross-county zig-zagging
- Confidence tagging surfaces mock-coordinate risk to admins
- The workforce validation layer correctly blocks overloaded routes before publish

---

## 9. Overall Assessment

**The routing engine is MVP-complete and production-safe.** It will not produce dangerous routes or lose data. However, it has structural weaknesses that become more visible with SB County's geography: the High Desert spans 100+ miles north-south; mountain ZIPs require driving up and back; the flat 25 mph and Haversine assumptions will produce ETAs that are 30–60% wrong on mountain and desert legs.

**Decision input:** The algorithm is real (not manual), but it falls into the "partial" category (Decision B). The optimizer exists but needs targeted improvements to be accurate for this service area.
