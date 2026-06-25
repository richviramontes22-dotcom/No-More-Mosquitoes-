# Technician Operations / GPS Validation Report

## Summary

Clock in/out works and is independently solid. GPS/location tracking exists only as a narrow,
consent-gated, event-triggered write path — and what it writes is never read back anywhere. The brief's
framing ("Clocked Out: no tracking. Clocked In: tracking enabled.") describes a designed behavior that does
not exist in this codebase; the actual behavior is unrelated to clock state entirely.

## Clock in / clock out — verified working

`POST /api/employee/shifts/clock-in` / `/clock-out` (`server/routes/employeeShifts.ts`): idempotent
clock-in (returns the existing open shift if already clocked in, rather than creating a duplicate),
resolves today's open shift automatically on clock-out if no `shift_id` is given, tracks break minutes.
Straightforward, correctly scoped to the authenticated employee, no issues found.

## GPS / location tracking — what actually exists

**Not continuous, not tied to clock state.** A location ping is recorded in `employee_location_pings`
**only** when a technician changes an assignment's status to `en_route` or `arrived`
(`server/routes/employeeAssignments.ts`), and only if `employees.gps_consent_at` is set (consent-gated,
correctly). There is no periodic/background ping while a technician is simply clocked in and idle, and
clocking in or out has **zero interaction** with location tracking in either direction — confirmed directly,
`employeeShifts.ts`'s clock-in/clock-out handlers reference nothing GPS- or location-related at all.

**What's written is never read.** `server/routes/adminTracking.ts` — the endpoint backing the admin "Live
Tracking" page — contains its own explicit, pre-existing comment confirming this:

> "NOTE: location (lat/lng) is NOT real GPS — no live tracking is implemented. The location field is always
> null until Phase 3B wires real device coordinates."

Confirmed live: `employee_location_pings` has **zero rows** in the database (consistent with assignments
never having existed to trigger a status-change ping, per the Phase 2 finding — but the gap exists
independently of that bug; even with working assignments, only `en_route`/`arrived` transitions would ever
produce a ping). No client file references `employee_location_pings` at all — not the admin tracking page,
not the employee-facing UI.

## Direct answers to the brief's specific checks

| Check | Result |
|---|---|
| Clocked Out: no tracking | True, but not because of any clocked-out check — tracking is gated on consent + assignment status events, which happen to only occur during active job work in practice |
| Clocked In: tracking enabled | **False as stated.** Clocking in does not enable anything; tracking is independent of clock state |
| Last ping | **Not implemented.** No code reads or surfaces the most recent `employee_location_pings` row anywhere |
| Stale ping detection | **Not implemented.** No "how long since last ping" logic exists |
| Offline technician detection | **Not implemented.** No code distinguishes "no recent ping" from "never consented" from "no GPS-triggering event has happened" |
| Route visibility (where is the technician relative to their route) | Not implemented — there's no real coordinate data to plot, and the admin map's `location` field is hardcoded `null` |
| Technician status board | **Exists, and works.** `/admin/employee-tracking` correctly shows idle / en_route / in_progress per technician, derived from `assignments.status` — this part has nothing to do with GPS and is independently solid |

## What this means for the Operations Command Center (Phase 7)

The "Technician Status" section of the new dashboard can correctly show clocked-in/out and
idle/en_route/in_progress/completed — all backed by real, working data (`shifts`, `assignments`). It
**cannot** show last-ping, staleness, or a live map position, because that data doesn't exist yet. The
dashboard will surface status accurately; it will not claim a GPS capability that isn't there.

## What should be built next (not built in this sprint — explicitly planning-only per this phase's scope)

1. A periodic ping while clocked in and GPS-consented (not just on assignment status change) — the
   prerequisite for "last ping" / staleness / offline detection to mean anything.
2. A `last_ping_at` + "stale after N minutes" computed field, surfaced on the admin tracking page and the
   new Operations Command Center.
3. Wiring the admin map to actually plot `employee_location_pings` coordinates instead of a hardcoded
   `null` — the data model (`latitude`, `longitude`, `accuracy_meters`) already supports this; only the
   read side and the continuous-ping write side are missing.
4. A consent-revoked / clocked-out enforcement check — currently nothing would *prevent* a ping from being
   recorded outside a shift if some other code path triggered an assignment status change while clocked
   out; today this is moot (no such path exists), but should be an explicit guard once continuous pinging
   is added, not an implicit accident of "nothing happens to trigger it today."
