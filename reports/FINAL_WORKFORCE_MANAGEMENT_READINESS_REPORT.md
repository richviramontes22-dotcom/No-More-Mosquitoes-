# Final Workforce Management Readiness Report
**Date:** 2026-06-01
**Sprint:** Workforce Management + Technician Availability Audit

---

## The 12 Required Answers

### 1. What workforce management exists today?

**Partial foundation. More than nothing, less than safe for production.**

What works:
- **Business hours** — global schedule with morning/afternoon windows, max jobs per window. Enforced in customer booking. Not enforced in route planning.
- **Blackout dates** — company-wide closed dates. Enforced in customer booking. Not enforced in route planning.
- **Shift tracking** — clock-in/out, break tracking, timesheet view for employees. Not used for availability decisions.
- **Employee status** — active/inactive toggle. The route planner uses this as its only availability filter.

What doesn't work:
- No technician weekly schedule
- No per-technician availability
- No time-off requests
- No route planning that respects any of the above

---

### 2. What is missing?

| Missing Feature | Operational Risk |
|----------------|-----------------|
| Technician weekly schedule | HIGH — planner assigns jobs on any day |
| Time-off / PTO workflow | HIGH — no way to block a technician for vacation |
| Sick day reporting | HIGH — no urgent reassignment workflow |
| Per-date availability overrides | HIGH — only workaround is deactivating the account |
| Route planner availability check | CRITICAL — routes are assigned without checking any availability |
| Per-technician capacity limits | MEDIUM — all techs get same cap |
| Service type / skill filtering | MEDIUM — all techs treated as interchangeable |
| Employee schedule visibility | MEDIUM — employees cannot see their upcoming schedule |
| Admin availability calendar | MEDIUM — no calendar view of technician availability |

---

### 3. What database changes are required?

**New tables required:**
1. `technician_schedule_templates` — weekly recurring schedule per tech per day
2. `technician_time_off_requests` — PTO/sick/personal leave request + approval
3. `technician_capacity_profiles` — per-tech limits (max stops, skills, service types, area prefs)
4. `technician_date_overrides` — one-off date exceptions (not full PTO)

**Existing tables to modify:**
- `employees` — add `hire_date`, `default_max_stops`, `service_area_ids`
- `service_areas` — fix schema mismatch (`zip`, `city`, `capacity`, `is_active` columns missing)
- `notification_log` — add workforce notification types to CHECK constraint

**No changes needed:**
- `blackout_dates` — `employee_id` column already exists; just needs backend + UI
- `business_hours` — already well-structured; no schema changes

---

### 4. How should technician availability work?

Four-layer resolution (highest priority first):
1. **Approved time-off** → technician excluded from all routes
2. **Date override** (admin-created) → specific date exception (available or not)
3. **Schedule template** → recurring weekly schedule (Mon–Fri, partial days, etc.)
4. **Active status** → baseline; if no template, defaults to "available on business days"

The route planner calls `isTechnicianAvailable(techId, date)` before adding any tech to the candidate pool. Unavailable technicians are completely excluded — their unassigned appointments go to the `unassigned_appointments` return list.

---

### 5. How should PTO/time off work?

Employee flow:
1. Employee submits request on `/employee/schedule` (type, dates, reason)
2. Admin reviews on `/admin/workforce/time-off` — sees conflict with any existing routes
3. Admin approves or rejects with optional note
4. On approval: `technician_date_overrides` rows created, route planner enforces automatically
5. Employee and admin both notified

Sick day special case:
- Employee taps "Report Sick Today" → auto-approved for same day → urgent admin alert
- Admin manually reassigns affected appointments

---

### 6. How should capacity be modeled?

Per-technician capacity profiles stored in `technician_capacity_profiles`:
- **Max stops/day** — overrides the global `max_jobs_per_tech` window setting
- **Max service minutes** — optional cap on total on-site time
- **Skill level** — junior/standard/senior/specialist
- **Allowed service types** — restrict techs to what they're trained/licensed for
- **Preferred service areas** — soft routing preference
- **Home base** — route optimization starting point

Resolution hierarchy: date override → schedule template → capacity profile → global default.

---

### 7. How should routing use workforce constraints?

**Single change required in `adminRoutes.ts` day planner:**

```
BEFORE: get active techs → assign by load
AFTER:  get active techs → filter by availability → filter by service type → assign by load + capacity
```

Specific checks in order:
1. Company blackout date → reject entire route generation
2. Per-tech approved time-off → exclude that tech
3. Per-tech date override → exclude if `is_available = false`
4. Per-tech schedule template → exclude if `is_working = false` for that day
5. Service type matching → only assign qualifying appointments to qualified techs
6. Capacity limit → respect per-tech `max_stops`, not the global hardcoded `8`

Conflict notes are stored on `routes.conflict_notes` so admin sees exactly why slots are empty.

---

### 8. What admin UI is needed?

| Page | Priority |
|------|----------|
| `/admin/workforce/schedules` — 7-day grid editor per tech | HIGH |
| `/admin/workforce/time-off` — pending/approved/rejected with conflict info | HIGH |
| `/admin/workforce/capacity` — per-tech stop limits + skills | MEDIUM |
| `/admin/workforce` — hub/overview | MEDIUM |
| `/admin/workforce/availability-calendar` — visual calendar view | LOW (Phase D) |

---

### 9. What employee UI is needed?

| Page/Feature | Priority |
|--------------|----------|
| `/employee/schedule` — view weekly schedule, upcoming days | HIGH |
| Time-off request form (on schedule page) | HIGH |
| "Report Sick Today" button (on dashboard + schedule page) | HIGH |
| Request status tracking (pending/approved/rejected) | HIGH |
| Request cancellation (pending only) | MEDIUM |

---

### 10. What notifications are needed?

**Admin alerts (via `admin_alerts` + email):**
- Time-off requested (info)
- Sick day reported (warning — urgent)
- Time-off approved with route conflicts (warning)
- No technicians available for route generation (critical)
- Technician over capacity (warning)

**Employee notifications (email + in-app):**
- Time-off approved
- Time-off rejected (with admin note)
- Schedule updated by admin
- Route published for scheduled day

---

### 11. What should be implemented first?

**Sprint A is the immediate priority.** The two-function server fix is the highest-leverage change:

1. Add `isTechnicianAvailable(techId, date)` function to server
2. Call it in the day planner before adding any technician to the candidate pool
3. Add company blackout date check before route generation begins

These two changes fix the critical operational risk with minimal code. They can be deployed before any database migrations if they gracefully fall back when no schedule tables exist yet.

**Database migrations (Sprint A) come next:** `technician_schedule_templates`, `technician_date_overrides`, `technician_capacity_profiles`.

**Time-off workflow (Sprint B)** follows after the availability foundation is solid.

---

### 12. What can wait until post-beta?

| Feature | Wait Until |
|---------|-----------|
| Visual availability calendar | Post-beta (Sprint D) |
| Service-area-specific business hours in UI | Post-beta |
| Max service minutes / minute-based capacity | Post-beta (Sprint C) |
| Skill level routing enforcement | Post-beta (Sprint C) |
| Analytics (utilization reports, availability trends) | Post-beta (Sprint D) |
| Advanced dispatch board (drag-to-assign visual) | Post-beta (Sprint D) |
| Multi-level approval chains | Never (external HR tool's job) |
| Payroll/PTO accrual tracking | Never (external payroll tool's job) |

---

## Readiness Score

| Domain | Score | Notes |
|--------|-------|-------|
| Business hours | 8/10 | Works for booking; not enforced in routing |
| Blackout dates | 6/10 | Works for booking; not enforced in routing |
| Technician schedule | 0/10 | Doesn't exist |
| Time-off workflow | 0/10 | Doesn't exist |
| Capacity modeling | 2/10 | Global cap exists; no per-tech |
| Route planner availability check | 0/10 | Not implemented |
| Admin workforce UI | 2/10 | Employee list only; no schedule/time-off UI |
| Employee schedule UI | 0/10 | Doesn't exist |
| Workforce notifications | 1/10 | Infrastructure exists; no workforce events |

**Overall Workforce Readiness: 2.1/10**

---

## Risk Score

| Risk | Severity | Likelihood | Mitigated? |
|------|----------|-----------|------------|
| Route assigned to vacationing tech | HIGH | CERTAIN (today) | NO |
| Route assigned to sick/absent tech | HIGH | CERTAIN | NO |
| Over-capacity assignment (one tech gets 15+ stops) | MEDIUM | LIKELY | PARTIAL |
| No availability on a date → silent failure | HIGH | POSSIBLE | NO |
| Employee has no way to flag unavailability | HIGH | CERTAIN | NO |

**Overall Risk: HIGH** — The routing system is not production-safe for multi-technician operations without Sprint A.

---

## Beta Recommendation

### Current State: **NO-GO for Multi-Technician Production Use**

The system can function for a single-technician operation where the owner manually controls dispatch. For anything beyond that, the current routing system will inevitably assign jobs to unavailable technicians.

### Path to CONDITIONAL GO

**Minimum Viable Workforce Safety (1–2 days of work, no migrations required):**
1. Add company blackout date check to route generation (uses existing table)
2. Add `max_stops_per_tech` as a configurable request body parameter (vs. hardcoded)
3. Add warning message when no available techs found (vs. silent empty result)

**Full CONDITIONAL GO (Sprint A complete, ~1–2 weeks):**
1. All Sprint A migrations applied
2. Admin sets schedule templates for all active technicians
3. Route planner availability check implemented and tested
4. Per-technician capacity profiles set

**Full GO (Sprint B complete, ~2–4 weeks total):**
1. Time-off workflow implemented and tested
2. Sick day reporting live
3. Employee schedule page deployed
4. Workforce notifications wired

**The codebase is well-positioned for these additions.** The route planner is clean and modular. Adding availability checks is a targeted, low-risk change. The database schema patterns are consistent and the new tables follow the same conventions.
