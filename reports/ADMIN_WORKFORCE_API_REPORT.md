# Admin Workforce API Report
**Date:** 2026-06-01
**File:** `server/routes/adminWorkforce.ts`

---

## Endpoints (14 total — all admin-only)

### Overview
`GET /api/admin/workforce/overview`

Returns: `{ active_technicians, missing_schedules, missing_capacity_profiles, upcoming_blackouts[], setup_complete }`

Used by the Workforce Hub page to show status at a glance.

---

### Schedules

`GET /api/admin/workforce/schedules` — all templates for all techs

`GET /api/admin/workforce/schedules/:employeeId` — schedule + overrides + today's availability for one tech

`POST /api/admin/workforce/schedules/:employeeId` — upsert weekly schedule
Body: `{ days: Array<{day_of_week, is_working, work_start, work_end, max_stops, notes}>, effective_from }`
Upserts on `(employee_id, day_of_week, effective_from)` — safe to call on every save.

`PATCH /api/admin/workforce/schedules/:employeeId` — same as POST (partial day updates)

---

### Date Overrides

`GET /api/admin/workforce/overrides` — upcoming overrides; optional `?employee_id=` and `?from=` / `?to=` filters

`POST /api/admin/workforce/overrides` — create or update override (upserts on `employee_id, override_date`)
Body: `{ employee_id, override_date, is_available, work_start, work_end, max_stops_override, reason }`

`PATCH /api/admin/workforce/overrides/:id` — update specific fields on an existing override

`DELETE /api/admin/workforce/overrides/:id` — remove override (restores normal schedule for that date)

---

### Capacity Profiles

`GET /api/admin/workforce/capacity` — all profiles

`GET /api/admin/workforce/capacity/:employeeId` — profile + effective capacity for today

`POST /api/admin/workforce/capacity/:employeeId` — create or replace capacity profile (upserts on `employee_id`)

`PATCH /api/admin/workforce/capacity/:employeeId` — partial update of capacity fields

---

### Validation

`GET /api/admin/workforce/validation?date=YYYY-MM-DD` — runs full workforce validation for all routes on date

Returns `ValidationResult` from `workforceValidation.ts`.

---

## Auth

All routes call `requireAdmin()` — validates Bearer JWT, checks `profiles.role = 'admin'`. Returns 401/403 on failure.

All DB writes use `supabaseAdmin` (service role, bypasses RLS).

---

## Error Handling

| Scenario | Response |
|----------|---------|
| Missing required field | 400 with `{ error: "field required" }` |
| DB error | 500 with `{ error: message }` |
| Not admin | 401 or 403 |
| No rows to update | 400 "No fields to update" |
