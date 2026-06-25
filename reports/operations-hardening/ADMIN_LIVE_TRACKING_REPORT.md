# Admin Live Tracking Report

## What changed

`server/routes/adminTracking.ts` — both endpoints (`GET /tracking/employees` and
`GET /tracking/employees/:id`) rewritten to read real data instead of hardcoding `location: null`. No new
tables; reuses `employee_location_pings`, `employees.gps_consent_at`, and `shifts`.

For each employee, the response now includes:

- `clocked_in` — a real, batched lookup of today's open shifts (`shifts` where `clock_out_at IS NULL`).
- `has_gps_consent` — straight from `employees.gps_consent_at IS NOT NULL`.
- `last_ping_at` — the most recent `employee_location_pings.captured_at`, fetched in one batched query
  (ordered newest-first, deduped to one per employee in memory — PostgREST has no native "latest per
  group," so this was the simplest correct option without a DB view/RPC).
- `is_stale` — `null` if not clocked in (staleness isn't a meaningful concept for someone off shift), else
  `true` if no ping in the last 10 minutes (≈10x the 60s ping interval — comfortably past normal jitter,
  tight enough to actually mean something's wrong).
- `location_label` — `"current"` (clocked in, ping within the staleness window), `"last_known"` (real
  coordinates exist, but the technician is off shift or the ping is stale), or `"unavailable"` (no consent,
  or no ping ever recorded).
- `location` — coordinates, or `null`.

## Consent and staleness rules — enforced, not just displayed

- **No consent → no coordinates, period.** `location` is only populated when `has_gps_consent` is true,
  even if a ping happens to exist (e.g., from before consent was withdrawn). This is enforced server-side
  in the endpoint itself, not left to the frontend to remember to hide it.
- **Clocked-out technicians can show a location, but only labeled as historical.** Per this sprint's
  explicit rule ("do not show location for clocked-out technicians unless explicitly labeled"), `location`
  is still returned for an off-duty technician with consent and a past ping — but `location_label` is
  `"last_known"`, and the client renders it as `"Last known: ... (off duty)"` in amber, distinct from the
  green `"current"` styling. Hiding it outright would arguably be more conservative, but the brief
  permits showing it as long as it's clearly not claimed to be live — verified visually (see below).
- **Stale data is visually distinguished**, not folded into the same "current" bucket as a technician who
  pinged 30 seconds ago.

## Frontend — `client/pages/admin/EmployeeTracking.tsx`

- Removed the old "Demo Data — Live GPS Tracking Not Yet Enabled" banner (referencing a different,
  nonexistent `employee_locations` table) and replaced it with an accurate note: data is real, but polled
  every ~45 seconds, not real-time.
- Polling interval reduced from 5s to 45s — within this sprint's stated 30–60s acceptable range, and closer
  to the actual ~60s ping cadence (polling every 5s when the underlying data changes roughly every 60s was
  pure waste).
- Per-employee rows now show a "Clocked In"/"Clocked Out" badge, a "No GPS consent" tag when applicable,
  and one of three location states: "No recent location," a green current-position line with a relative
  timestamp, or an amber "Last known: ... (off duty)" / "... (stale)" line.
- Renamed the refresh toggle from "Auto-refresh (demo)" / "Manual refresh (demo)" to "Auto-refresh: On/Off"
  — the "(demo)" labeling predated real data and was no longer accurate.
- `EmployeeMap.tsx` (the canvas-based map component) needed **no changes** — it was already written to
  filter to `employees.filter(e => e.location)` and project real lat/lng onto the canvas; it was just never
  fed real coordinates before. Confirmed this by visual inspection of its existing code.

## Verified live, in a real browser

Used the existing GPS test technician from the Phase 4 verification, which already had:
- `has_gps_consent: true`
- Two real pings in the database (one simulated via curl, one from the real Phase 4 Playwright browser run)
- Currently clocked out (left in that state at the end of Phase 4)

Loaded `/admin/employee-tracking` as an admin and confirmed, via direct API response inspection AND a
Playwright screenshot of the rendered page:

```json
{
  "name": "GPS Tester",
  "clocked_in": false,
  "has_gps_consent": true,
  "last_ping_at": "2026-06-24T05:14:34.896753+00:00",
  "is_stale": null,
  "location_label": "last_known",
  "location": { "lat": 33.6, "lng": -117.8 }
}
```

The rendered row showed exactly: **"Clocked Out"** badge, no "No GPS consent" tag, and
**"Last known: 33.600, -117.800 · 27m ago (off duty)"** in amber — correctly distinguishing it from the
42 other (pre-existing, route-generation test) technicians, all of which correctly show "Clocked Out,"
"No GPS consent," and "No recent location," since none of them have ever had consent granted.

Zero console errors on the page itself (one unrelated, pre-existing transient fetch failure on
`/api/admin/subscriptions/needs-scheduling` — a different dashboard widget's background poll, confirmed via
`grep` to live in `Overview.tsx`/`Appointments.tsx`, nothing this sprint touched).
