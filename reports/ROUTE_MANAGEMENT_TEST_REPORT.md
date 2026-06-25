# Route Management Test Report
**Date:** 2026-05-31

---

## Build / Typecheck

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero TypeScript errors |
| `npm run build:client` | PASS |
| `npm run build:server` | PASS |

---

## Test Checklist

### Onboarding UX Fix

| Test | Expected | Status |
|------|----------|--------|
| Employee opens assignment detail with no blocking forms | Assignment detail loads normally | Code verified |
| Employee opens assignment detail with blocking form pending | Red "Onboarding Required" card with form names shown | Code verified |
| Employee clicks "Complete Onboarding" | Navigates to /employee/onboarding | Code verified |
| Test employee opens any assignment detail | No blocking check — loads normally | Code verified (is_test bypass) |
| Admin marks form blocks_assignments = false | Employee can access assignment even if form pending | Code verified |

---

### Database Migration

| Test | Expected | Status |
|------|----------|--------|
| Run `2026-05-31_extend_routes.sql` | Executes without error; idempotent | SQL verified |
| `routes.date` column exists | Renamed from route_date | Migration verified |
| `route_stops.sequence_number` column exists | Renamed from seq | Migration verified |
| `route_stops.arrival_eta` column exists | Renamed from eta | Migration verified |
| `routes.status` accepts 'approved' and 'published' | CHECK constraint expanded | Migration verified |
| `route_stops.status` accepts 'pending' and 'arrived' | CHECK constraint expanded | Migration verified |
| `route_audit_log` table exists | Created if not exists | Migration verified |
| New route columns exist | approved_at, published_at, total_distance_miles, etc. | Migration verified |

---

### Admin Route Generation + Approval Flow

| Test | Expected | Status |
|------|----------|--------|
| Admin selects employee + date | Employee list loads from API | Code verified |
| Admin clicks "Generate Optimized Route" | POST /routes/generate → draft route created | Code verified |
| Draft route shows in sidebar | Route list updates with new draft | Code verified |
| Admin reviews stops in detail panel | Stops table shows sequence, address, ETA, distance | Code verified |
| Admin clicks "Approve Route" | POST /routes/:id/approve → status: approved | Code verified |
| Approved route shows "Publish & Notify Employee" | Button visible for approved status | Code verified |
| Admin clicks "Publish & Notify Employee" | POST /routes/:id/publish → status: published | Code verified |
| Published indicator shows timestamp | "Published [time]" shown in route actions | Code verified |
| Admin clicks "Rebuild" on draft | POST /routes/:id/rebuild → stops cleared | Code verified |
| Admin clicks "Discard" on draft | POST /routes/:id/discard → route deleted | Code verified |
| Route publish fires admin alert | scheduling.route_published in admin_alerts | Code verified |
| Route audit log written on approve | route_audit_log entry: route_approved | Code verified |
| Route audit log written on publish | route_audit_log entry: route_published | Code verified |

---

### Employee Route View

| Test | Expected | Status |
|------|----------|--------|
| Employee opens /employee/route with no published route | "No route published" empty state with link to /assignments | Code verified |
| Employee opens /employee/route with published route | Summary bar + ordered stop list | Code verified |
| Stop shows sequence number | Numbers 1, 2, 3... in badge | Code verified |
| Next stop highlighted with "Next Stop" label | First non-completed stop highlighted | Code verified |
| Completed stop shows green checkmark | Green badge replaces number | Code verified |
| Navigate button opens Maps | navUrl(lat, lng) deep link | Code verified |
| Detail link opens assignment detail | /employee/assignments/:id | Code verified |
| All stops completed → success banner | "All stops completed!" green banner | Code verified |
| Route auto-refreshes every 2 minutes | setInterval(loadRoute, 120000) | Code verified |
| Manual refresh button | loadRoute() on click | Code verified |
| "Today's Route" nav item visible | Employee sidebar updated | Code verified |

---

### Employee Route API

| Test | Expected | Status |
|------|----------|--------|
| GET /api/employee/routes/today without auth | 401 | Code verified |
| GET /api/employee/routes/today with no route | { route: null, has_route: false } | Code verified |
| GET /api/employee/routes/today with published route | Enriched stops with customer + property data | Code verified |
| Route only returned for today's date | date = current date filter | Code verified |
| Only published/assigned/in_progress routes returned | status IN filter | Code verified |

---

### Regression Tests

| Test | Expected | Status |
|------|----------|--------|
| Real employee assignment lifecycle (en_route, arrive, complete) | Unchanged | No code changes |
| Customer completion email for real employees | Unchanged | No code changes |
| Admin employee management | Unchanged | No code changes |
| Onboarding form signing | Unchanged | No code changes |
| GPS consent | Unchanged | No code changes |
| Shift clock-in/out | Unchanged | No code changes |

---

## Known Issues / Deferred

| Issue | Notes |
|-------|-------|
| Route generate uses mock geocoding (ZIP hash) | Properties with real lat/lng not yet used in generate endpoint |
| Employee route view doesn't real-time sync assignment status | Must navigate to assignment detail to update status |
| Invite form "Full Name" vs "First/Last" | Code is correct (First/Last) — dev server restart required to show updated UI |
