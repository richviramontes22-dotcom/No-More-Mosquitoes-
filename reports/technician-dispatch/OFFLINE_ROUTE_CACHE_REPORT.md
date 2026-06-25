# Offline Route/Assignment Cache Report

## What was built

**`client/lib/employee/offlineCache.ts`** — localStorage, not IndexedDB (see the file's own comment for why:
the data is small and simple enough — one technician's one day — that localStorage's synchronous API avoids
real complexity for no real benefit at this scale). Every entry is an envelope of
`{ ownerId, cachedAt, data }`, namespaced under `nmm-employee-cache:`. Read paths double-check the stored
`ownerId` matches the id being asked for (defense in depth beyond the key itself), and expose `isExpired`
(24h) so callers decide whether stale-but-present data is still worth showing.

| Cached | Keyed by | Wired into |
|---|---|---|
| Today's route + stops | employee id + date | `client/pages/employee/Route.tsx` |
| Assignment list | employee id + date | `client/hooks/employee/useEmployeeAssignments.ts` |
| Assignment detail (address, customer contact, notes, status) | employee id + assignment id | `client/pages/employee/AssignmentDetail.tsx` |
| Employee record | auth user id | `client/hooks/employee/useEmployee.ts` |
| Resolved portal role | auth user id | `client/components/auth/RequireEmployee.tsx` |

The last two aren't in the brief's own cache list, but turned out to be necessary prerequisites — see below.

## Rules from the brief, and how each is met

- **Technician's own data only**: every cache function takes an explicit owner id and writes/reads under a
  key that includes it; the read path also verifies the envelope's stored `ownerId` matches. Unit-tested
  directly (`offlineCache.spec.ts`): asking for employee B's data after caching employee A's returns `null`
  in every case (route, assignments, assignment detail, role).
- **Clear cache on logout**: `clearEmployeeCache()` is called from `AuthContext.tsx`'s shared `logout()` —
  the one place every portal's sign-out goes through — so a second technician signing in on the same device
  never sees the previous one's cached route data. Unit-tested: populates every cache kind, calls
  `clearEmployeeCache()`, confirms all of them return `null` afterward, and confirms it doesn't touch
  unrelated localStorage keys.
- **Expire after 24 hours**: `isExpired` computed at read time from `cachedAt`. Unit-tested by forging a
  26-hour-old write (temporarily faking `Date.now()`) and confirming `isExpired: true` while the data itself
  is still returned — callers (e.g. `Route.tsx`) decide whether to actually use expired data; today's
  implementation treats expired the same as absent for display purposes.
- **"Offline / Cached Data" indicator**: a global banner (`OfflineIndicator`, built in Phase 2) is mounted
  in `EmployeeLayout.tsx` and visible on every technician page whenever `navigator.onLine` is false.
  `Route.tsx` and `AssignmentDetail.tsx` additionally show a page-specific amber banner with the exact cached
  timestamp when the page is actually rendering cached (not live) data — a stronger, more specific signal
  than the global "you're offline" banner alone.
- **Do not cache admin/customer-service data**: nothing here touches `/admin/*`, `/employee/tickets`, or
  `/employee/satisfaction` — the cache module is only ever imported by employee-portal route/assignment/
  identity code.

## Two real bugs found while wiring this up — not pre-existing knowledge, found through testing

1. **`/employee/route` has likely never actually shown a published route to any technician.**
   `server/routes/adminRoutes.ts` is double-mounted (`/api/employee` and `/api/admin` — see
   `server/index.ts`), and the handler's own path was `/employee/routes/today`. Mounted at `/api/employee`,
   that resolves to `/api/employee/employee/routes/today` — never matching what `Route.tsx` actually calls
   (`/api/employee/routes/today`). That exact path instead fell through to this same file's
   `/routes/:routeId` handler (treating `"today"` as a route id), which 401s for a non-admin technician.
   Confirmed directly: before the fix, `/api/employee/routes/today` returned `401`; the (accidentally
   reachable) `/api/employee/employee/routes/today` returned `200` with real data. Fixed by changing the
   handler's path to `/routes/today` (confirmed via `grep` that nothing else in the client calls either of
   the old double-prefixed paths, so this was safe). Re-verified: the correct client-facing path now returns
   `200`, and `Route.tsx` correctly caches the result. This was found purely as a side effect of testing
   Phase 3's caching — the cache had nothing to write because the endpoint it depends on never actually
   worked from the path the client calls.
2. **Reloading the employee portal offline could render the wrong portal entirely.** Documented in
   `TECHNICIAN_PWA_FOUNDATION_REPORT.md`'s findings — `RequireEmployee.tsx` falls back to the JWT's cached
   role when the live profile fetch fails, and that JWT role can be stale relative to the real
   `profiles.role`. Fixed here: `RequireEmployee.tsx` now also checks a cache populated by this same
   module (`cacheEmployeeRole`/`getCachedEmployeeRole`, keyed by auth user id) whenever it has *online*
   confirmed a valid employee role, and falls back to that cached value — but only when `navigator.onLine`
   is false and both live sources (profile, JWT) fail to qualify. Never consulted while online — the live
   data path stays authoritative whenever it's actually reachable. `useEmployee.ts` got the equivalent fix
   for the same reason: the employee record itself is the key everything else here is scoped by, so losing
   it on a reload would make the rest of the cache unreachable even though it's sitting right there in
   localStorage.

## Verified

- **Live, repeatedly, via Playwright against the real dev server**: visiting `/employee/route` while online
  correctly writes `route:`, `assignments:`, `employee-record:`, and `role:` cache entries (confirmed by
  reading them back out of `localStorage` directly) — including after the route-endpoint-path fix, where
  the route cache went from never populating to populating correctly.
- **`pnpm test`**: 12 new tests in `offlineCache.spec.ts` (ownership scoping, date scoping, 24h expiry,
  `clearEmployeeCache`'s scope and safety, and graceful degradation when `localStorage.setItem` throws or
  stored JSON is corrupted) — all passing, 207/207 project-wide.
- **`pnpm typecheck`**: clean.

## A verification gap, stated plainly rather than glossed over

A single, continuous "load route online → go fully offline → reload the page → see the cached route with
the offline banner" browser test against a real production build did not come back clean in this session —
not because the caching logic failed (the same session repeatedly confirmed the cache populates correctly,
and Phase 2 separately confirmed a full offline reload renders the real app shell from cache for a simpler
page), but because locally running the built Node server for this kind of test proved intermittently
unreliable in this environment (a login-form click not registering in one run, then a previously-valid
token getting rejected in a later run against the same locally-spawned server — both look like local-test-
harness flakiness, not application bugs, since the dev server handled the identical account and token
without issue throughout). Given that, the offline-fallback logic in `RequireEmployee.tsx`/`useEmployee.ts`
is verified by: direct code review, the unit tests above for the storage layer it depends on, and Phase 2's
already-successful full-offline-reload test of a different (simpler) page using the same `navigator.onLine`-
gated pattern. It has not been proven with one unbroken end-to-end run of the more complex route-page
scenario, and that's worth knowing rather than claiming otherwise.
