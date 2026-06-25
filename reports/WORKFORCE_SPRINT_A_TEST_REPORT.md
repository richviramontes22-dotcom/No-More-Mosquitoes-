# Workforce Sprint A Test Report
**Date:** 2026-06-01

---

## Build / Typecheck

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero TypeScript errors |
| `npm run build:server` | PASS — 445 kB ✓ 1.43s |
| `npm run build:client` | PASS |

---

## Test Checklist

### Database Migration

| Test | Expected | Status |
|------|----------|--------|
| Apply `2026-06-01_workforce_sprint_a.sql` | Runs without error | SQL verified idempotent |
| `technician_schedule_templates` exists | Table in Supabase | Migration verified |
| `technician_date_overrides` exists | Table in Supabase | Migration verified |
| `technician_capacity_profiles` exists | Table in Supabase | Migration verified |
| `employees.default_max_stops` exists | Column in Supabase | Migration verified |

### Availability Service

| Test | Expected | Status |
|------|----------|--------|
| No schedule configured | Returns `available: true` with warning | Code verified |
| Schedule configured: working day | Returns `available: true` with work hours | Code verified |
| Schedule configured: day off | Returns `available: false`, reason `not_scheduled` | Code verified |
| Date override: unavailable | Returns `available: false`, reason `date_override` | Code verified |
| Company blackout in `blackout_dates` | Returns `available: false`, reason `company_blackout` | Code verified |
| Employee inactive | Returns `available: false`, reason `employee_inactive` | Code verified |

### Capacity Service

| Test | Expected | Status |
|------|----------|--------|
| No capacity profile, no default_max_stops | Returns `max_stops: 8`, source `global_default` | Code verified |
| `employees.default_max_stops = 6` | Returns `max_stops: 6`, source `employee_default` | Code verified |
| Capacity profile with `max_stops_per_day = 5` | Returns `max_stops: 5`, source `capacity_profile` | Code verified |
| Date override with `max_stops_override = 3` | Returns `max_stops: 3`, source `date_override` (highest priority) | Code verified |

### Route Planner — Day Planner

| Test | Expected | Status |
|------|----------|--------|
| Company blackout on requested date | `POST /routes/day/generate` returns 400 | Code verified |
| All techs unavailable | Returns 200 with `routes: []` + no_technicians_available alert | Code verified |
| Some techs unavailable | Unavailable techs excluded from route creation | Code verified |
| Available techs: capacity honored per-tech | Each tech gets their own `max_stops` limit | Code verified |
| Capacity overflow | Overflow goes to `unassigned_appointments` | Code verified |
| `workforce_notes` populated | Notes include excluded tech reasons | Code verified |

### Route Planner — Single Tech

| Test | Expected | Status |
|------|----------|--------|
| Unavailable tech generates route | 400 with reason + hint | Code verified |
| Unavailable tech + `force: true` | Route created + `route_forced_override` audit log | Code verified |
| Available tech | Route created normally | Code verified |
| Capacity enforced | Assignments over cap excluded | Code verified |

### Day Publish Validation

| Test | Expected | Status |
|------|----------|--------|
| Publish with no blockers | Succeeds normally | Code verified |
| Publish with critical blocker | 400 with validation result | Code verified |
| Publish with critical blocker + `force: true` | Succeeds + audit log | Code verified |
| Publish with warnings only | Succeeds + warning audit log | Code verified |

### Admin Workforce APIs

| Test | Expected | Status |
|------|----------|--------|
| `GET /api/admin/workforce/overview` | Returns counts for missing schedules + capacity | Code verified |
| `POST /api/admin/workforce/schedules/:id` | Upserts 7 schedule rows | Code verified |
| `POST /api/admin/workforce/overrides` | Creates date override | Code verified |
| `DELETE /api/admin/workforce/overrides/:id` | Removes override | Code verified |
| `POST /api/admin/workforce/capacity/:id` | Creates or replaces capacity profile | Code verified |
| `PATCH /api/admin/workforce/capacity/:id` | Updates specific fields | Code verified |
| `GET /api/admin/workforce/validation?date=` | Returns validation result | Code verified |

### Admin UI Pages

| Test | Expected | Status |
|------|----------|--------|
| `/admin/workforce` loads | Hub page with status banner | Code verified |
| Technician list loads in schedules | Active techs/dispatchers listed | Code verified |
| Select technician → schedule loads | 7-day grid shows with defaults | Code verified |
| Toggle working day → save → reload | Schedule persists | Code verified |
| Add date override → appears in list | Override visible | Code verified |
| `/admin/workforce/capacity` loads | Technician list + empty state | Code verified |
| Select technician → capacity loads | Effective today shown + form populated | Code verified |
| Save capacity → reload | Profile persists | Code verified |

### Regression Tests

| Test | Expected | Status |
|------|----------|--------|
| Single-tech generate (available tech) | Route generated normally | Code verified |
| Day planner (all techs no schedule) | Uses default behavior (backward-compat) | Code verified |
| Employee route view | Unchanged | No code changes |
| Assignment status sync | Unchanged | No code changes |
| Onboarding forms | Unchanged | No code changes |
| Customer flows | Unchanged | No code changes |
