# GPS Tracking Implementation Report

## What was built

No new tables — everything reuses `employee_location_pings` (already existed, previously write-only via a
different event-triggered path), `employees.gps_consent_at` (already existed, grant/revoke already worked),
and `shifts` (already existed for clock in/out).

### Backend — `server/routes/employeeShifts.ts`

1. **`GET /api/employee/shifts/current`** (new) — returns today's open shift, or `null`. Exists so the
   dashboard knows the *real* clocked-in state on page load, not just within an uninterrupted session (see
   the "page-reload gap" finding in `GPS_TRACKING_AUDIT.md`).
2. **`POST /api/employee/shifts/location-ping`** (new) — accepts `{ latitude, longitude, accuracy }`, and
   independently re-verifies, server-side, on *every single call*:
   - Authenticated as a real, active employee (reuses the existing `getAuthEmployee` helper).
   - `gps_consent_at IS NOT NULL` → `403 NO_CONSENT` if not.
   - An open shift exists today → `403 NOT_CLOCKED_IN` if not.
   
   Only after all three pass does it insert into `employee_location_pings` with `status_trigger: "periodic"`
   (distinguishing it from the existing `en_route`/`arrived` event-triggered pings) and `assignment_id: null`
   (the column was already nullable for exactly this kind of non-assignment-tied ping).

### Frontend

3. **`client/hooks/employee/useLocationTracking.ts`** (new) — takes a single `enabled: boolean` and handles
   everything else: requests `navigator.geolocation`, sends an immediate ping plus one every 60 seconds
   while enabled, and tears the interval down the instant `enabled` flips to `false`. Returns a status
   (`"off" | "active" | "permission_denied" | "unsupported"`) for the UI to render. The server-side checks
   above are the real enforcement — this hook is the client side of that contract, not a substitute for it.
4. **`client/pages/employee/Dashboard.tsx`** — fetches real clock state on mount via the new `current`
   endpoint (fixing the reload gap), computes `trackingEnabled = clockedIn && !!employee.gps_consent_at`,
   passes it to the hook, and renders a clear, state-specific "Location Tracking: On/Off/Blocked/Unavailable"
   indicator (not just a static "GPS active" banner that doesn't reflect whether tracking is *actually*
   running right now).
5. **`client/components/employee/ClockWidget.tsx`** — now accepts an `initialOnDuty` prop so it correctly
   shows "On Duty" immediately on page load when a shift is genuinely open, instead of always starting "Off
   Duty" until the next click (the same reload gap, fixed at the widget level too).
6. **`client/pages/employee/Profile.tsx`** — updated the GPS toggle's descriptions (both the static text and
   the toast on enable/disable) to accurately describe the new clock-in-tied periodic behavior instead of
   the old "active assignments only" wording, which would have been misleading once this shipped.

## Rules enforced, and where

| Rule | Enforced where |
|---|---|
| Tracking only runs when authenticated | `getAuthEmployee` — same pattern as every other employee endpoint |
| Tracking only runs when consented | Server: `location-ping`'s `gps_consent_at` check (every call). Client: `trackingEnabled` computation |
| Tracking only runs when clocked in | Server: `location-ping`'s open-shift check (every call). Client: `trackingEnabled` computation, fed by the real (not session-local) clock state |
| Tracking only runs when browser grants permission | `useLocationTracking`'s `getCurrentPosition` error callback → `"permission_denied"` status, no ping attempted |
| Tracking stops on clock-out | `handleClockOut` sets `clockedIn = false` → `trackingEnabled` flips false → hook's effect cleanup clears the interval immediately |
| Tracking stops on consent revoke | Existing `/api/employee/onboarding/consent/withdraw` clears `gps_consent_at` → next data refresh flips `trackingEnabled` false → same cleanup. (Also independently enforced server-side regardless of client state — see below.) |
| Tracking stops on logout | Component unmounts on navigation away → hook's `useEffect` cleanup fires, same as any other React effect teardown |
| Browser denial handled gracefully | A distinct, clearly-worded "Location Tracking: Blocked" state, not a silent failure or a generic error |

## Verified live, in a real browser, not just by code review

Used Playwright with mocked (not real-device) geolocation and explicit permission grants — a fresh
disposable test technician (`qa-gps-test@test.com`), consent granted via direct database update (equivalent
to using the Profile toggle), then:

1. **Before clock-in**: page correctly showed `"Location Tracking: Off — will turn on automatically when you clock in."`
2. **Clicked "Clock In" in the real UI** (not an API call) → page correctly flipped to
   `"Location Tracking: On — your location is shared with dispatch every minute while you're clocked in."`
3. **A real ping landed in the database** within seconds, with the exact mocked coordinates
   (`33.6, -117.8`), `status_trigger: "periodic"`, `source: "simulated"` (correctly detected the test
   employee flag).
4. Zero console errors throughout.

Also verified every server-side rejection path directly via the API, independent of the browser test:

| Scenario | Result |
|---|---|
| Ping with no consent, not clocked in | `403 {"error":"GPS consent not granted","code":"NO_CONSENT"}` |
| Ping with consent granted, still not clocked in | `403 {"error":"No open shift — clock in to enable tracking","code":"NOT_CLOCKED_IN"}` |
| Ping with consent + open shift | `200 {"ok":true}`, real row inserted |
| Ping immediately after clocking out | `403 NOT_CLOCKED_IN` again — confirms tracking stops the moment a shift closes, not just whenever the client happens to notice |

## One real bug found and fixed during this verification, unrelated to GPS itself

The test technician account initially redirected to `/onboarding` instead of `/employee` on login —
because `/api/dev/create-test-account` always sets `profiles.role = "customer"`, and a separate `employees`
row alone doesn't change that. Not a GPS bug; just a reminder that a dev-created test account needs its
`profiles.role` set explicitly to a staff role to exercise the employee portal at all. Documented here so
the next person creating a technician test account via this path doesn't lose time on the same thing.
