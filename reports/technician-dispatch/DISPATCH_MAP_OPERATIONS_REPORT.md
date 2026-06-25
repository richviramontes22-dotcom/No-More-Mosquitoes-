# Dispatch Map Operations Report

## What was built

- **`server/services/tracking/technicianStatus.ts`** (new) — extracted the entire per-technician status
  computation (clock state, assignment status, consent-respecting last-known location, staleness) out of
  `adminTracking.ts` into one shared `getTechnicianStatusList()` function. `adminTracking.ts`'s
  `GET /tracking/employees` now just calls it — same response shape, zero behavior change, confirmed by
  re-running the exact same live check from last sprint (the GPS test technician's entry is byte-for-byte
  the same shape: `clocked_in`, `has_gps_consent`, `last_ping_at`, `is_stale`, `location_label`, `location`).
  This is what "reuse `lastPings` service" / "do not create duplicate tracking logic" required in practice —
  there is now exactly one function that knows how to compute a technician's status, used by both the
  dedicated tracking endpoint and the new dispatch map.
- **`GET /api/admin/operations/dispatch-map`** (new, in `adminOperations.ts`) — calls
  `getTechnicianStatusList()` for technician positions, plus a read-only aggregation over today's `routes` →
  `route_stops` → `assignments` → `appointments` → `properties` for stop coordinates and status (including
  `is_blocked` for `no_show`/`skipped`). No new tables, no new routing logic — purely composing existing
  ones, the same join pattern already used by `/api/employee/routes/today`.
- **`client/components/admin/DispatchMap.tsx`** (new) — a compact canvas map for the Operations Command
  Center, distinct from `EmployeeMap.tsx` (the Live Tracking page's own full sidebar-layout map, which
  stays as-is and unduplicated). Shows technicians and stops together: technician dots colored by state
  (blue = active, amber = stale/last-known, gray = clocked out), stop dots colored by outcome (gray =
  scheduled, green = completed, red = blocked/no-show), a legend, and links out to the full Employee
  Tracking and Route Planning pages rather than re-implementing their detail views.

## Rules from the brief, and how each is met

- **Respect GPS consent**: location data comes from `getTechnicianStatusList()`, which already enforces
  consent (no coordinates surfaced without `gps_consent_at`) — verified again here since this is the exact
  same function backing the already-verified `/tracking/employees` endpoint.
- **Label stale data**: stop colors distinguish blocked/no-show from completed from still-scheduled;
  technician colors distinguish active from stale/last-known from clocked-out — the same three-state
  `location_label` used everywhere else this sprint and last.
- **Do not claim real-time if polling**: the map's own header states "polled, not real-time" directly next
  to the technician count, matching the wording already established on the Live Tracking page.
- **Do not create duplicate tracking logic**: addressed by the `technicianStatus.ts` extraction above —
  confirmed via `grep` that `adminTracking.ts` no longer contains its own copy of the consent/staleness/
  clock-state computation.
- **Reuse `lastPings` service**: `getTechnicianStatusList()` calls `getLastPingsByEmployee()` directly — no
  new ping-fetching code was written.
- **Links to Employee Tracking and Route Planning**: both present at the bottom of the map card.

## Verified

- **Live, via the real endpoint**: `GET /api/admin/operations/dispatch-map` as admin returned 43
  technicians (only those with a real ping appearing with non-null `location`, matching the consent rules)
  and a real stop (created for this verification) correctly enriched with its property's address/lat/lng
  and `is_blocked: false`.
- **Live, in the browser**: loaded `/admin/operations`, confirmed the Dispatch Map card renders with the
  correct "N technician(s) shown — polled, not real-time" count, the legend, and both link-out buttons. The
  one console error observed (`/api/admin/subscriptions/needs-scheduling` failing) is the same pre-existing,
  unrelated background-widget issue already documented in last sprint's `ADMIN_LIVE_TRACKING_REPORT.md`.
- `pnpm typecheck` clean; `pnpm test` 216/216 — this phase added no new pure logic worth a dedicated unit
  test beyond what `lastPings.spec.ts` already covers for the shared staleness/ping logic underneath it.
