# Technician App — Roadmap

**Status: Planning only. Nothing in this roadmap was implemented as part of this study.**

## Phase 0 — Fix what's already half-built (web, no platform decision needed)

These deliver real value immediately, are needed under *every* future platform option,
and are small, contained changes:

1. Build the read-side of `employee_location_pings`: a live (or near-live, e.g. 30–60s
   poll) map on the admin Employee Tracking page, replacing the current simulated-data
   placeholder, plus a "last ping" timestamp and a stale/offline indicator per technician.
2. Add geolocation capture to `POST /shifts/clock-in` and `/shifts/clock-out`.
3. Fix break-minute aggregation so `shifts.break_minutes` actually reflects
   `break_start`/`break_end` events instead of staying at 0.
4. Define and implement a retention/deletion policy for raw `employee_location_pings`
   rows (currently unbounded).
5. Log admin access to technician location data into the existing audit-log pattern
   (`onboarding_audit_log` already establishes the convention).

## Phase 1 — PWA layer on the existing web app (short-term)

1. Add a web app manifest (installable, home-screen icon, splash screen) and a service
   worker for offline asset caching.
2. Add an offline write-queue (IndexedDB-backed) for status updates, treatment notes, and
   photo/video uploads made while offline — sync on reconnect.
3. Add Android web push (new assignment, route change, schedule change) via the Push API.
   Document clearly to stakeholders that iOS push will not work reliably under this option.
4. Ship a persistent "tracking is ON/OFF" UI indicator tied to clock-in state, even though
   actual background tracking isn't possible yet on iOS — this is still useful UX
   (and a compliance-friendly practice) for the existing foreground-only ping capture.

**Decision gate at the end of Phase 1**: review actual field usage. If technicians and
dispatch are satisfied with foreground-only location pings + Android-only push + offline
queuing, **stop here** — Phase 2 is a real cost and should only proceed on a genuine,
validated need for background tracking, iOS push, or more robust offline media handling.

## Phase 2 — React Native app (medium-term, conditional on Phase 1's outcome)

1. Stand up a new React Native project consuming the existing REST API as-is (no backend
   rewrite needed beyond Phase 0's items).
2. Port the technician-facing screens: today's route, assignment detail/status actions,
   treatment notes, media upload, timesheets, profile.
3. Implement real background location: foreground service + notification on Android,
   `Always`/`When in Use` permission flow on iOS, **explicitly torn down on clock-out** —
   this is the feature this entire roadmap exists to unlock.
4. Implement native push (APNs + FCM) for new assignment / route change / schedule change
   / emergency alert.
5. Implement a native local-DB offline queue for status updates, notes, and media capture,
   with sync-on-reconnect and basic conflict resolution (e.g. last-write-wins with a
   visible "synced/pending" indicator per item — sufficient for this use case's actual
   conflict risk, which is low single-technician-per-job).
6. Add device-level security: require biometric/passcode re-auth after a configurable
   idle period, on top of the existing session-timeout behavior.
7. App Store / Play Store submission and review.

## Phase 3 — Long-term operating model

1. React Native app becomes the primary tool for technicians (anyone who needs
   background GPS, push, or offline media capture).
2. The responsive web app remains the right tool for customer service, sales, and admin —
   none of those roles need background location, push, or offline capture, so there's no
   reason to force them into a native app.
3. Revisit the admin "live location" experience once real ping data is flowing
   continuously (not just at status-change moments) — this is where the investment in
   Phase 0's read-side work pays off fully.
4. Periodically review the GPS consent form text/version against any changes in
   California guidance, and confirm the off-duty-cessation behavior is still verifiably
   enforced (e.g. via a test that confirms no pings are recorded after clock-out).

## What this roadmap deliberately does not include

- A Flutter track — not recommended for this team (see `TECHNICIAN_APP_ARCHITECTURE.md`
  and `TECHNICIAN_APP_COST_ANALYSIS.md` for why).
- Any change to pricing, business logic, or non-technician parts of the app.
- Any implementation work in this sprint — Phases 0–3 above are a plan to be explicitly
  approved and scheduled separately, not work already underway.
