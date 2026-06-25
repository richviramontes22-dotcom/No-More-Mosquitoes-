# Technician Mobile App — Feasibility Study

**Status: Planning only. No app was built as part of this study.**

## 1. What exists today (baseline)

The technician experience is a responsive React SPA under `/employee/*`, served the same
way as the rest of the site — no native app, no PWA, no offline support, no push
notifications. Specifically, as of this audit:

- **Auth**: Supabase email/password via the shared `AuthTabs` component, same login flow
  as customers/admins, gated by `RequireEmployee` (checks `profiles.role` from the
  database, not the JWT).
- **Time tracking**: `POST /api/employee/shifts/clock-in` / `clock-out` exist and are
  idempotent (re-clocking in returns the already-open shift). **No geolocation is
  captured at clock-in/out.** Breaks have event types (`break_start`/`break_end`) but
  `shifts.break_minutes` is never actually aggregated from them — it stays `0`.
- **Location tracking**: `employee_location_pings` table exists and **is being written
  to today** — every time a technician taps a status button (En Route / Arrive /
  Complete / Skipped / No-Show), the browser's `navigator.geolocation` is read once and
  a row is inserted, *if and only if* `employees.gps_consent_at` is set. **Nothing reads
  this table back.** The admin "Employee Tracking" page explicitly shows simulated demo
  data with a banner stating live tracking isn't wired up yet. This is a half-built
  feature: the write path and consent gate are production-ready; the read/visualization
  path was never built.
- **Consent**: Versioned and auditable — `gps_consent_at` + `gps_consent_form_version_id`
  are stamped together when a technician signs the `gps_consent` onboarding form, and
  `POST /api/employee/onboarding/consent/withdraw` cleanly revokes both. This is a solid
  foundation to build on; the gap is entirely on the tracking/visualization side, not consent.
- **Routes & ETAs**: Two real optimizers exist server-side (`dayPlanGenerator.ts`,
  `smartRoutingOptimizer.ts`) producing sequenced stops with arrival ETAs, drive-cap
  checks, and confidence scoring. The employee-facing "My Route" page polls
  `GET /api/employee/routes/today` every 2 minutes — not push-driven, but functional.
- **Job actions**: Real, working status machine (`en_route`, `in_progress`, `completed`,
  `no_show`, `skipped`) with a "Blocked / Unable to Service" UI path that maps to
  `no_show`/`skipped` plus a reason. A pre-service checklist exists but is hardcoded
  (6 fixed labels), not DB-configurable.
- **Documentation**: Treatment notes (`assignments.technician_notes`) and job media
  (photos/videos to Supabase Storage, `job_media` table) both work end-to-end today,
  including an admin alert on upload.
- **Notifications**: Email (Resend) and SMS (Twilio, with a null-provider fallback) on
  assignment created/updated/cancelled. **No push notifications, no in-app channel.**
- **Offline**: None. No service worker, no manifest, no offline queue of any kind.

**Bottom line**: roughly 70% of a technician app's *business logic* already exists and
works — it's just delivered as a web page instead of a packaged, installable,
background-capable app. The work ahead is overwhelmingly about **device-level
capabilities** (background location, push, offline, installability), not about inventing
new domain logic.

## 2. Requirement-by-requirement assessment

### Authentication, role verification, session handling
Already solid — Supabase JWT + canonical DB-role check pattern is reusable as-is by any
client (web, PWA, native) since it's just HTTP + a stored token. **No blocker for any option.**

### Time tracking (clock in/out, breaks)
Functionally present but two real gaps regardless of platform chosen: (1) no location
captured at clock-in/out, (2) break minutes aren't aggregated. Worth fixing in the
*existing* web app before any platform migration — these are data-completeness bugs, not
platform limitations.

### Location tracking (consent-gated, clock-in-scoped)
This is the **central platform-deciding requirement**. The current implementation only
captures a location point at discrete *status-change* moments (a handful of times per
job), while the requirement set in this study asks for tracking **continuously while
clocked in, automatically off while clocked out** — i.e., real background tracking, not
point-in-time snapshots. This is the single requirement where Responsive Web and PWA
diverge sharply from React Native/Flutter (see Section 3).

### Route management (today's route, stop order, ETA, navigation handoff)
Already implemented server-side and reasonably platform-agnostic — any client can
consume `GET /api/employee/routes/today`. Navigation handoff (deep-linking into Google/
Apple Maps) works today in the browser and works identically in a native app.

### Appointments (start, en route, arrived, complete, unable to service, reschedule)
Already implemented. Native/PWA wrapping doesn't change this — it's a UI/API capability,
not a device capability.

### Documentation (photos, videos, notes, offline queue)
Photos/videos/notes already upload directly to Supabase Storage from the browser. The
**offline queue** (capture now, upload when signal returns) does not exist in any form
today and is meaningfully harder to build well in a browser tab that can be backgrounded/
killed by the OS than in a native app with a real background task API.

### Customer interaction (call, text, directions)
`tel:`/`sms:`/maps deep links work identically in a mobile browser and a native app —
not a differentiator.

### Offline capability (no/poor signal, cached route, queued writes, sync recovery)
Does not exist today in any form. This is the area where the gap between "responsive
web" and "real app" is most visible to a technician working in a backyard with no signal.

### Push notifications (new assignment, route change, emergency alert)
Does not exist today. Email/SMS partially cover this but are not real-time/in-app.

### Security (lost device, session timeout, role revocation)
Session timeout and role revocation already work via Supabase (revoking a role server-side
takes effect on next token refresh/check). Lost-device handling is materially better with
native app + device-level passcode/biometric gating than with a browser tab that may
auto-fill saved credentials.

### Admin visibility (live location, status, last ping, stale indicator, audit trail)
**Not implemented at all today** — this is the missing read-side of the location-pings
table described above. It's needed regardless of which platform is chosen for the
technician side; it is pure backend/admin-UI work that should happen either way.

## 3. Why "continuous background location while clocked in" is the deciding requirement

This single requirement determines which platforms are even viable:

- **Responsive Website / PWA on iOS**: Safari suspends background JavaScript almost
  immediately when a tab is backgrounded or the screen locks — there is no reliable way
  to keep capturing GPS pings once the technician switches apps or the phone locks,
  which is the normal state of a phone in a holster/pocket while driving between stops.
  iOS also requires a *installed, foreground-capable* context for any geolocation beyond
  brief foreground bursts; true background geolocation on iOS web is not supported by
  any browser engine, full stop — this is an OS-level restriction, not a "future browser
  update will fix it" gap.
- **PWA on Android**: meaningfully better than iOS (Android service workers can do more),
  but background location while the PWA isn't the foreground app is still unreliable
  compared to a native app holding a proper foreground service with a location
  notification — and most of this app's likely technician fleet will include iPhones,
  so an Android-only improvement doesn't solve the core problem.
- **React Native / Flutter**: both can register a genuine OS-level background location
  service (iOS: `Always`/`When in Use` location permission + background location capability;
  Android: a foreground service with a persistent notification, which is *required* by
  modern Android to keep background location alive and is also the right UX — it gives
  the "clear status indicator" this study's GPS policy explicitly requires).

**Conclusion**: if continuous clocked-in tracking is a real product requirement (not just
"nice to have"), Responsive Web and PWA cannot deliver it reliably on iOS. That is a hard
platform ceiling, not an engineering-effort problem to be solved with more dev time.

## 4. California labor / privacy considerations (general principles — not legal advice)

These are well-established general principles for employer location tracking under
California law and should be reviewed with employment counsel before launch, not treated
as a complete compliance checklist:

- **Business-purpose limitation**: tracking should be scoped to a legitimate work purpose
  (route verification, customer-arrival confirmation, theft/loss prevention for company
  vehicles/equipment) and disclosed as such.
- **Notice and consent**: California favors clear, written disclosure of monitoring
  practices before they begin. This app's `gps_consent` onboarding form + versioned,
  re-signable consent record is a good foundation — it should explicitly state *when*
  tracking happens (only while clocked in) and *why*.
- **Off-duty cessation**: tracking must stop when the employee is off the clock. This is
  exactly what "track only while clocked in, auto-disable on clock-out" achieves — and it
  needs to be enforced at the OS/background-service level, not just by the app politely
  not sending pings (a background service that isn't explicitly torn down on clock-out
  could keep running).
- **Data minimization & retention**: only collect what's needed for the stated purpose,
  and define a retention/deletion policy for raw ping data (the current schema has no
  retention policy — pings accumulate indefinitely today, which should be addressed
  regardless of platform choice).
- **Transparency to the employee**: a persistent, visible "tracking is ON" indicator
  (this study's own requirement) is also a compliance-friendly practice, not just good UX.
- **Audit trail**: who consented, when, to what version of the policy, and any access to
  the location data — already partially covered by `gps_consent_form_version_id` and
  `onboarding_audit_log`; should be extended to log *admin access* to location data too.

## 5. Recommendation summary (see TECHNICIAN_APP_ROADMAP.md for phasing)

- **Short-term**: stay on the responsive web app; fix the half-built pieces (location
  read-side/admin map, clock-in/out geo, break aggregation) — these deliver real value
  immediately and are needed under *any* future platform.
- **Medium-term**: if continuous background tracking, push notifications, or reliable
  offline capture become firm requirements (not just nice-to-haves), build a native app.
- **Architecture choice**: see `TECHNICIAN_APP_ARCHITECTURE.md` for the React Native vs.
  Flutter comparison and recommendation.
