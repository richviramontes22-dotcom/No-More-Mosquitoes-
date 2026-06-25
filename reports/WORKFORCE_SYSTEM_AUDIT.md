# Workforce System Audit
**Date:** 2026-06-01
**Project:** No More Mosquitoes — Workforce Management Audit

---

## Summary Verdict

The platform has a **partial workforce management foundation** — business hours, blackout dates, and shift tracking exist and work. However, there is **no per-technician availability system**, no time-off workflow, no per-technician capacity model, and the route planner assigns technicians without checking any of these constraints. The risk is real and operational: the day planner can and will assign jobs to technicians who are on vacation, sick, or simply not scheduled to work that day.

---

## Capability Matrix

| Capability | Exists | Enforced in Routing | Admin UI | Employee UI |
|------------|--------|---------------------|----------|-------------|
| Business hours (global) | YES | YES (scheduling) | YES | Read-only |
| Blackout dates (company-wide) | YES | YES (scheduling) | YES | NO |
| Blackout dates (per-employee) | Schema only | NO | NO | NO |
| Employee shift clock-in/out | YES | NO | NO | YES (Timesheets) |
| Technician weekly schedule | NO | NO | NO | NO |
| Per-technician availability | NO | NO | NO | NO |
| Time-off requests (PTO) | NO | NO | NO | NO |
| Sick day reporting | NO | NO | NO | NO |
| Per-technician capacity limits | NO | NO (global only) | NO | NO |
| Service area staffing assignments | NO | NO | NO | NO |
| Skill / service type restrictions | NO | NO | NO | NO |
| Admin availability calendar | NO | — | NO | — |
| Employee schedule page | NO | — | — | NO |

---

## What Exists — Detail

### 1. Business Hours (`business_hours` table)
- Global week schedule: Mon–Fri open with morning/afternoon windows, Sat morning only, Sun closed
- Each window has `max_jobs_per_tech` (default 3 morning, 3 afternoon, 2 Saturday)
- Enforced in `GET /api/availability` and `POST /api/schedule`
- Admin can edit via `/admin/settings/business-hours` (BusinessHours.tsx)
- Supports service-area-specific overrides in DB; not yet exposed in UI

### 2. Blackout Dates (`blackout_dates` table)
- Company-wide or service-area-specific blackouts
- Scope column supports `'all'`, `'service_area'`, `'employee'`
- `'employee'` scope has the column but zero code implements it
- Enforced in `GET /api/availability` — blocks appointment scheduling on blocked dates
- NOT enforced in route planning (no check in `POST /api/admin/routes/day/generate`)
- Admin can manage via admin UI

### 3. Shift Tracking (`shifts` + `time_events` tables)
- Employees clock in/out via `POST /api/employee/shifts/clock-in`
- Shift date, clock_in_at, clock_out_at, break_minutes tracked per shift
- `time_events` tracks granular events (break_start, break_end, arrive, start_job, etc.)
- `geo` column on time_events exists but never populated
- Employees view via Timesheets page; NO admin view
- Shift history shows what happened; does NOT drive availability or routing decisions

### 4. Service Areas (`service_areas` table)
- Supports ZIP-code based geographic zones
- `business_hours` can be service-area-specific
- `blackout_dates` can be service-area-scoped
- NO technician-to-service-area assignment exists
- Route planner groups by ZIP cluster but ignores service area assignments

### 5. Employee Status
- `employees.status` = 'active' | 'inactive'
- Route planner filters to `status = 'active'` only
- No granularity: active = always available, every day, every shift

---

## What Does NOT Exist — Critical Gaps

### Gap 1: Technician Weekly Schedule
No table, no API, no UI. The system cannot express "Luis works Monday, Wednesday, Friday" or "Carlos works Tuesday and Thursday." The route planner assigns any active technician to any date.

### Gap 2: Per-Technician Availability Overrides
No way to mark a specific technician as unavailable on a specific date without deactivating their entire account. Making someone inactive removes them from the employee portal entirely.

### Gap 3: Time-Off Requests
No workflow exists. Employees cannot request PTO, sick days, or personal days. Admins cannot approve or reject such requests. The system has no concept of approved time off.

### Gap 4: Per-Technician Capacity
- `max_jobs_per_tech` exists on business_hours windows (global setting)
- No per-technician override: a part-time tech gets the same cap as a full-time tech
- No `max_service_minutes` or `max_drive_minutes` per technician
- No skill-based filtering (can't restrict mosquito treatments to licensed applicators only)

### Gap 5: Route Planner Does Not Check Availability
The critical operational risk. In `adminRoutes.ts`, the day planner:
```typescript
const { data: techs } = await db.from("employees")
  .select("id, user_id")
  .eq("status", "active")        // ← only check: is employee active?
  .in("role", ["technician", "dispatcher"]);
```
No check for: day of week, approved time off, per-employee blackout, service area assignment, or capacity preferences.

### Gap 6: No Employee Schedule Visibility
Employees cannot see "you are scheduled Wednesday and Thursday this week." The only schedule-adjacent view is the Timesheets page (past hours) and the Assignments page (today's jobs). There is no forward-looking schedule or availability page.

---

## Risk Assessment

| Risk | Severity | Current State |
|------|----------|--------------|
| Day planner assigns vacationing technician | HIGH | Unmitigated |
| Day planner assigns tech on company blackout day | HIGH | Partial (blackout blocks customer booking but not route assignment) |
| Route overloads one technician while others are available | MEDIUM | Partially mitigated by round-robin ZIP distribution |
| Admin has no way to block a specific tech for a date | HIGH | Only workaround: deactivate entire account |
| Employee has no way to signal unavailability | HIGH | No mechanism exists |
| Dispatch ignores technician skill/license requirements | MEDIUM | All techs treated as interchangeable |

---

## Existing Infrastructure That Can Be Leveraged

| Asset | How to Leverage |
|-------|----------------|
| `blackout_dates.scope = 'employee'` | Already has `employee_id` column — needs backend + UI to use it |
| `business_hours` with window model | Extend to per-technician schedule templates |
| `shifts` table | Proof that a technician actually worked; can verify against schedule |
| `employees.status` | Coarse on/off switch; needs a finer-grained layer added above it |
| Route planner availability filter point | One function in `adminRoutes.ts` to add availability check |
