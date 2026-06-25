# Route Review UX Report

## What already existed (audited before changing anything)

`RoutePlanning.tsx` was already substantially feature-complete against the brief's list: technician name,
stop count, total distance, confidence badge, coordinate warnings (`conflict_notes`), approval status,
publish status, approve/publish actions, and a "Smart Optimize → preview → apply" flow that already covers
reordering (computer-assisted, applied via the existing `reorder-stops` endpoint) — none of this was rebuilt
or touched beyond what's described below. The routing engine and the existing automation policies
(`routeAutomationPolicy.ts`, the day/single-route generation flows) were not modified at all.

## What was actually missing, and what was added

1. **Estimated drive time and estimated service time, shown separately.** `total_duration_minutes` existed
   on the route record but was never rendered anywhere, and isn't split between driving and on-site time to
   begin with. Rather than inventing a new estimate, `GET /api/admin/routes/day` now sums the per-stop
   figures the routing engine already produces (`route_stops.duration_from_prev_minutes` for drive,
   `estimated_duration_minutes` for service) and returns `estimated_drive_minutes`/
   `estimated_service_minutes` per route. The route cards show both ("Drive ~Xm · Service ~Ym").
2. **Safety blockers, visible proactively, not just after a blocked publish attempt.** Found that
   `validateRouteForWorkforce(routeId)` — a complete, already-correct per-route safety check — existed in
   `workforceValidation.ts` but had **zero HTTP endpoint exposing it on its own**; the only caller was
   `validateDayPlanForWorkforce()`, itself only ever invoked internally during the publish flow. An admin
   reviewing a route had no way to see safety blockers without first attempting (and getting rejected from)
   a publish. Added `GET /api/admin/routes/:routeId/safety-check` — a thin wrapper calling the existing
   function directly, gated behind the same `flags.workforceValidation()` flag the publish flow already
   respects — and a "Safety Check" button per route card that calls it on demand. Deliberately on-demand,
   not automatic for every route on every page load: the underlying check does real database lookups
   (technician availability, schedule template, capacity profile), and running it unprompted for every
   route on every Day Planner load would multiply this page's query cost for no benefit over a one-click
   check.
3. **Link to map view.** Each route card now links to `/admin/operations`, where this sprint's Phase 6 work
   added a real dispatch map showing today's technicians and stops together — rather than building a second,
   redundant map specific to this page.

## Verified live

- `GET /api/admin/routes/day?date=...` for a real test route returned
  `estimated_service_minutes: 30, estimated_drive_minutes: 0` — correct for a single-stop route with no
  preceding drive leg.
- `GET /api/admin/routes/:routeId/safety-check` for that same route returned real, specific results: a
  critical blocker ("Technician is unavailable on 2026-06-24: company_blackout") and two warnings (missing
  schedule template, missing capacity profile) — genuine output from the existing validation function
  against real test data, not a stub.
- A screenshot of the rendered route card confirms "Drive ~0m · Service ~30m" and, after clicking "Safety
  Check," the same blocker/warning text rendering correctly in the new red/amber result panel.
- `pnpm typecheck` clean; `pnpm test` 216/216 — this phase's backend changes (a query field addition and a
  thin wrapper around an already-tested function) didn't introduce new logic complex enough to need a new
  dedicated unit test beyond what already exercises `workforceValidation.ts` indirectly through the publish
  flow's own behavior.
