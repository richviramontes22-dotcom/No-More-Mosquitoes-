# GPS Tracking Audit

## What is written today?

A row in `employee_location_pings` (`employee_id`, `assignment_id`, `latitude`, `longitude`,
`accuracy_meters`, `status_trigger`, `source`, `is_test`) — but **only** when a technician changes an
assignment's status to `en_route` or `arrived` (`server/routes/employeeAssignments.ts`), and only if
`employees.gps_consent_at IS NOT NULL`. Confirmed live in the prior sprint: this table has zero rows in the
database, because the only thing that ever triggers a write (an assignment status change) never had any
real assignments to change status on until this sprint's route-generation fix.

**Consent grant/revoke already fully exists and works**, independent of anything new in this sprint:
`client/pages/employee/Profile.tsx`'s GPS toggle sets `gps_consent_at` directly on enable, and calls a
dedicated, audit-logged `/api/employee/onboarding/consent/withdraw` endpoint on revoke. This sprint reuses
it; it doesn't need to be built.

## What is read today?

Nothing. `server/routes/adminTracking.ts` — the endpoint backing `/admin/employee-tracking` — has its own
explicit comment: `"location (lat/lng) is NOT real GPS — no live tracking is implemented... always null"`.
The client page (`EmployeeTracking.tsx`) has an even more explicit banner: **"Demo Data — Live GPS Tracking
Not Yet Enabled,"** referencing a *different, nonexistent* `employee_locations` table (not
`employee_location_pings`, the real one) and a roadmap doc (`dev-notes/master-audit/NEXT_DEVELOPMENT_ROADMAP.md`).
`employee_location_pings` is currently pure write-only dead data — nothing in the codebase queries it.

## What is missing?

1. **Any tracking tied to clock-in state.** `employeeShifts.ts`'s clock-in/clock-out handlers have zero
   interaction with location or GPS, in either direction. Clocking in does not start anything; clocking out
   does not stop anything (because nothing is running to stop).
2. **Any periodic ping mechanism.** The only write path is event-triggered (a job-status button press), not
   a recurring "still here" signal — so a technician who is clocked in and driving between stops, or
   stationary without changing an assignment's status, generates zero location data.
3. **Any read of `employee_location_pings`** — by the admin tracking page, by the Operations Command
   Center, by anything.
4. **Last-ping / staleness / offline computation.** No code anywhere computes "how long since this
   technician's last ping" or flags a technician as offline.
5. **A "clocked in but not currently visible on the map" state changes nothing on the dashboard** because
   the dashboard doesn't read real pings to begin with.

## How should tracking be tied to clock-in state?

Per this sprint's explicit rules (also the natural privacy-respecting design): a ping should only be
**accepted by the server** when all of the following hold, checked server-side on every ping, not just
client-side:

1. The request is authenticated as a real employee (existing `getAuthEmployee` pattern, already used by
   `employeeShifts.ts`).
2. That employee has `gps_consent_at IS NOT NULL`.
3. That employee has an **open shift today** (`shifts` row with `clock_out_at IS NULL`) — the same check
   `employeeShifts.ts`'s own clock-out handler already does to resolve "today's open shift."

Client-side, the periodic ping loop should start when clock-in succeeds and the employee is consented, and
stop immediately on clock-out, consent revocation, or logout — but the **server-side checks above are the
real enforcement**, since a client can always be tampered with or simply not stopped cleanly (a closed tab,
a crashed page). If the server didn't independently verify consent and shift state on every single ping,
a client-side-only guard would be security theater, not a safeguard.

## What consent safeguards exist?

- Per-employee opt-in, defaulting to off (`gps_consent_at` is `NULL` until explicitly granted).
- Revocation is a distinct, audit-logged action (`/api/employee/onboarding/consent/withdraw`), not just
  flipping a boolean — there's a record of *when* consent was withdrawn.
- RLS on `employee_location_pings`: admins read all, employees read only their own pings (no employee can
  read another's location history even if they tried a direct query).

## What safeguards are missing?

1. **No server-side enforcement that a ping requires an open shift.** The existing event-triggered ping
   write path (`employeeAssignments.ts`) checks consent but not clock-in state — an assignment status
   change *could* theoretically happen without an open shift (unusual in practice, since the employee
   portal's own UI flow assumes a clocked-in technician, but nothing technically prevents it server-side
   today).
2. **No employee-facing "tracking is currently on/off" indicator anywhere.** The Dashboard's existing GPS
   banner ("GPS tracking active — location captured during active assignments only") describes the *old*,
   event-only behavior and will need updating once periodic tracking exists, so it doesn't claim a stronger
   guarantee than what's true, or fail to mention the new behavior.
3. **No browser-permission-denial handling.** Nothing today requests `navigator.geolocation` for periodic
   tracking, so there's nothing yet to gracefully degrade when the browser blocks it.
4. **Clock state isn't reliably known across a page reload.** `TechnicianDashboard`'s `shiftId` (used to
   resolve which shift to clock out of) is local component state, set only when the employee clicks "Clock
   In" *during the current page session* — reloading the page while already clocked in loses that
   information, and `ClockWidget`'s own "On Duty" indicator is *also* local-only state defaulting to
   off. This is a real gap directly relevant to Phase 4: gating tracking on "currently clocked in" requires
   reliably knowing that state, including right after a page load with an already-open shift.
