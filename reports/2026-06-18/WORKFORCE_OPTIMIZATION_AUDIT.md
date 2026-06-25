# Workforce Optimization — Data Source Audit
**Date:** 2026-06-18

## Current Production Data Volumes

| Table | Row count |
|---|---|
| `employees` | 1 (and it's a test fixture — `worker_type: "test"`, `is_test: true`, `service_area_ids: []`) |
| `technician_capacity_profiles` | 0 |
| `technician_schedule_templates` | 0 |
| `technician_date_overrides` | 0 |
| `assignments` | 6 |
| `route_stops` | 0 |
| `routes` | 0 |
| `blackout_dates` | 0 |

**There are zero real technicians in production today.** This is the dominant fact for this audit — every question below has a correct, computable answer in principle, but with one test-fixture employee and no capacity profiles, the dashboard will show essentially nothing meaningful until real technicians and their schedules/capacity profiles are added. This must be designed for explicitly (empty states, not errors), not treated as an edge case.

## Existing Logic to Reuse, Not Duplicate

Two library functions already implement the exact resolution rules needed:
- `isTechnicianAvailable(techId, date)` (`server/lib/technicianAvailability.ts`) — priority chain: employee status → company blackout → employee blackout → approved time off → date override → weekly schedule template → business-hours default.
- `getEffectiveDailyCapacity(techId, date)` (`server/lib/technicianCapacity.ts`) — priority chain: global default (8) → `employees.default_max_stops` → `technician_capacity_profiles.max_stops_per_day` → `technician_schedule_templates.max_stops` → `technician_date_overrides.max_stops_override`.

Both are designed for **one technician, one date** (used during live route generation) and do several sequential DB round trips each. A dashboard needs **all technicians × a date range** at once — calling these in a loop would be an N+1 query pattern. The implementation (Phase 6) re-derives the same priority logic from bulk-fetched data instead of calling these functions in a loop, and says so explicitly rather than silently diverging from the canonical logic.

## Can we calculate technician utilization?

Yes, from `assignments` (which appointment is assigned to which `employee_id`, and its `status`) joined to `appointments` (`scheduled_at`, `status`) for counts, plus `getEffectiveDailyCapacity`-equivalent logic for the denominator. With 6 `assignments` rows and 1 employee, this is computable today but trivially small.

## Can we calculate appointment capacity by day?

Yes — sum of effective `max_stops_per_day` (or the resolved default) across all *available* technicians for a given date, compared against `appointments` scheduled for that date. `route_stops` (currently 0 rows) would be a more precise "stops actually planned" signal once routing automation/manual generation is in regular use; until then, `appointments.scheduled_at`/`scheduled_date` is the available proxy for "demand for that day."

## Can we calculate capacity by county/ZIP?

Partially. `employees.service_area_ids` (array of `service_areas.id`) is the intended link from a technician to the ZIPs/areas they cover — but it's empty (`[]`) on the one real employee row. Without that being populated, there's no way to attribute a technician's capacity to a specific county/ZIP today; the implementation falls back to "all available technicians serve all ZIPs" (the same assumption `dayPlanGenerator.ts` already makes — it doesn't filter technicians by ZIP either) and documents this as a known gap rather than fabricating a false breakdown.

## Can we detect overload?

Yes, as a ratio: scheduled stops (from `assignments`/`appointments`) ÷ effective capacity, for a given technician or day. >100% is overload by definition. With real data this is a real, useful signal; with one test employee and 6 fixture assignments, the computed result has correct math but no real-world meaning yet.

## Can we detect underutilization?

Yes, the inverse of the above — capacity far exceeding scheduled stops. Same data-volume caveat applies.

## Can we recommend hiring or shifting coverage?

As a rule-based heuristic only (consistent with "do not overcomplicate" and "read-only, no auto-hiring"): if a county/ZIP shows sustained overload (from Territory Intelligence's demand/customer counts) with no — or insufficient — technician coverage, surface "add coverage" / "add technician" as a suggestion with the reasoning spelled out, never as an automatic action. This is explicitly a text recommendation for a human to act on, nothing more.

## What is missing?

1. **Zero real technicians.** The single production `employees` row is a test fixture. Nothing about utilization, overload, or staffing recommendations can mean anything operationally until real technicians exist.
2. **`employees.service_area_ids` is unpopulated**, so there is no real technician-to-territory coverage mapping yet, even in principle, until admins fill this in.
3. **`technician_capacity_profiles`, `technician_schedule_templates`, `technician_date_overrides` are all empty.** Every capacity/availability number will fall back to the global default (8 stops/day, always "available") rather than a real, configured schedule.
4. **`route_stops`/`routes` are both empty** — no route has ever actually been generated in production (consistent with the Platform Growth Phase 2 smoke test finding that `route_automation_settings.enabled = false` and nothing has triggered generation yet). `assignments`/`appointments` are the only usable demand signal until that changes.
5. **No per-leg drive-time breakdown** exists (same limitation flagged in the original Routing Automation Policy report) — "route miles" / "estimated drive time" in the utilization table can only be a route-level total, not a true per-stop attribution.
