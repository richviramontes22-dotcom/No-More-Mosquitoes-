# Operations Command Center GPS Integration Report

## What was added

`server/routes/adminOperations.ts`'s `GET /api/admin/operations/summary` gained a `gps` section,
computed for technicians **currently clocked in** (GPS status isn't meaningful for someone off shift):

- `clocked_in_sharing` — clocked in, consented, and pinged within the last 10 minutes.
- `clocked_in_stale_or_silent` — clocked in and consented, but no ping in the last 10 minutes (a real
  signal something's wrong — dropped connection, backgrounded app, dead phone — worth a check-in call).
- `clocked_in_no_consent` — clocked in but has never granted GPS consent.
- `stale_threshold_minutes` — exposed so the frontend doesn't hardcode the threshold separately.
- `live_tracking_link` — points at `/admin/employee-tracking` for per-technician detail.

`client/pages/admin/Operations.tsx` renders these as three tiles in a new "GPS Visibility" section,
replacing the old static note ("Live GPS position is not yet available for this board").

## Extracted shared logic instead of duplicating it

The "latest ping per employee" lookup and staleness threshold (`server/services/tracking/lastPings.ts`)
were pulled out of `adminTracking.ts` (built in Phase 5) into a shared module, since Operations needed the
exact same computation. Both `adminTracking.ts` and `adminOperations.ts` now import from one place — there
is one definition of "stale" in the codebase, not two that could silently drift apart.

## A real, pre-existing bug found and fixed while verifying this

Live verification initially showed `technician_status.clocked_in: 0` and `gps.clocked_in_sharing: 0`
immediately after clocking in a real test technician — wrong. Root cause: `adminOperations.ts` computed
"today" as `new Date().toISOString().slice(0, 10)` (the **UTC** date), while `employeeShifts.ts` (clock-in/
clock-out) computes "today" via `format(new Date(), "yyyy-MM-dd")` (date-fns, **local server time**). The
server runs at UTC-7. That means for the ~7 hours between midnight UTC and midnight local time, every
single day, `adminOperations.ts` was looking up `shifts.shift_date` for a date that hadn't started yet
locally — undercounting clocked-in technicians, completed assignments, and (now) GPS status for a third of
every day. This predates this sprint; it just had never been caught because nothing had compared the two
endpoints' "today" against a real clock-in this precisely before.

**Fix**: `adminOperations.ts` now computes `today` with the same `format(new Date(), "yyyy-MM-dd")` call as
`employeeShifts.ts`, and `todayStart`/`todayEnd` via `startOfDay(now)` / `addDays(startOfDay(now), 1)`
(date-fns, local time) instead of hand-built UTC strings — giving the correct local-midnight-to-local-
midnight window expressed as the right UTC instants for comparing against `created_at`/`scheduled_at`
timestamp columns. Two `<=` comparisons against the now-exclusive `todayEnd` boundary were changed to `<`
for consistency with the DB queries' existing `.lt()` semantics.

Verified the fix directly: before, a real open shift produced `clocked_in: 0`; after, the same shift
produced `clocked_in: 1` and `gps.clocked_in_stale_or_silent: 1` (correctly bucketed — consented and
clocked in, but no ping within the last 10 minutes since the test session that produced its last ping had
ended).

## Verified live

- `GET /api/admin/operations/summary` as admin: `gps` section present with correct counts across three
  states (sharing / stale-or-silent / no-consent), confirmed by clocking a consented test technician in and
  out and watching the counts move.
- `pnpm typecheck` clean.
- `pnpm test` — 189/189 passing, no regressions from either the GPS summary addition or the date fix.
