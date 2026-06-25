# Workforce Implementation Roadmap
**Date:** 2026-06-01

---

## Sprint A — Availability Foundation (Highest Priority)
**Goal:** Stop the route planner from assigning unavailable technicians. Minimal UI required.

### Database (migrations)
- [ ] `technician_schedule_templates` — weekly recurring schedule per tech
- [ ] `technician_date_overrides` — per-date exceptions
- [ ] `technician_capacity_profiles` — per-tech stop limits and service qualifications
- [ ] Add `hire_date`, `default_max_stops` to `employees`
- [ ] Add `service_area_ids` to `employees` for area assignments

### Server
- [ ] `server/lib/technicianAvailability.ts` — `isTechnicianAvailable(techId, date)` function
- [ ] `server/lib/technicianCapacity.ts` — `getEffectiveDailyCapacity(techId, date)` function
- [ ] Update `POST /api/admin/routes/day/generate` to call `isTechnicianAvailable()` before including tech
- [ ] Update `POST /api/admin/routes/day/generate` to use `getEffectiveDailyCapacity()` instead of hardcoded `max_stops_per_tech = 8`
- [ ] Update `POST /api/admin/routes/generate` (single tech) to check availability + return 400 with reason if unavailable
- [ ] Add company blackout date check to route generation (reject if date is blacked out)
- [ ] Add workforce conflict notes to `routes.conflict_notes`
- [ ] New routes: `GET/POST/PATCH /api/admin/workforce/schedules`
- [ ] New routes: `GET/POST/PATCH /api/admin/workforce/capacity`

### Admin UI
- [ ] `/admin/workforce` — hub page
- [ ] `/admin/workforce/schedules` — 7-day grid editor per technician
- [ ] `/admin/workforce/capacity` — per-tech capacity cards

### Estimated Effort: 1–2 weeks

---

## Sprint B — Time-Off Workflow
**Goal:** Allow employees to request time off and admins to approve/reject with conflict awareness.

### Database
- [ ] `technician_time_off_requests` — request + approval workflow table

### Server
- [ ] `POST /api/employee/schedule/time-off` — employee submits request
- [ ] `GET /api/employee/schedule/time-off` — employee views own requests
- [ ] `DELETE /api/employee/schedule/time-off/:id` — employee cancels pending request
- [ ] `GET /api/admin/workforce/time-off` — admin views all requests (pending first)
- [ ] `POST /api/admin/workforce/time-off/:id/approve` — approve + create date overrides + notify
- [ ] `POST /api/admin/workforce/time-off/:id/reject` — reject + notify
- [ ] Conflict detection on submit and approve
- [ ] `POST /api/employee/schedule/sick` — report sick today (auto-approve + urgent admin alert)
- [ ] Add workforce notification types to notification_log CHECK constraint

### Admin UI
- [ ] `/admin/workforce/time-off` — pending/approved/rejected tabs with conflict warnings
- [ ] Sick day urgent panel at top of time-off page

### Employee UI
- [ ] `/employee/schedule` — schedule view + request time-off form
- [ ] "Report Sick Today" button on dashboard when on a scheduled day

### Notifications
- [ ] Admin alert: `workforce.time_off_requested`
- [ ] Admin alert: `workforce.sick_day_reported` (urgent/warning)
- [ ] Admin alert: `workforce.time_off_conflict_route`
- [ ] Employee email/in-app: approval/rejection notification

### Estimated Effort: 1–2 weeks

---

## Sprint C — Capacity Refinement + Service Type Filtering
**Goal:** Respect skill levels, service type qualifications, and minute-based capacity.

### Server
- [ ] Add service type filtering to assignment loop in day planner
- [ ] Add `max_service_minutes_per_day` enforcement if set on capacity profile
- [ ] Add skill level check to assignment logic
- [ ] Admin `GET /api/admin/workforce/conflicts?date=` — pre-flight conflict check for a date

### Admin UI
- [ ] Capacity page: add skill level, licensed applicator toggle, service type checklist
- [ ] Day planner: show "capacity warning" when a tech is approaching their limit
- [ ] Business hours: add service-area-specific hour overrides

### Employee UI
- [ ] Schedule page: show service types this tech is qualified for (read-only)

### Estimated Effort: 1 week

---

## Sprint D — Calendar + Advanced Dispatch (Post-Beta)
**Goal:** Visual availability calendar and advanced dispatch tooling.

### Admin UI
- [ ] `/admin/workforce/availability-calendar` — week/month view with one row per tech
- [ ] Dispatch board: visual slot-based appointment-to-technician assignment
- [ ] Route conflict heatmap (which dates/techs have capacity issues)

### Estimated Effort: 2–3 weeks

---

## Dependencies Map

```
Sprint A (availability foundation)
  └── Sprint B (time-off workflow)         ← depends on A's tables + isTechnicianAvailable()
        └── Sprint C (capacity/skills)     ← depends on B's workflow + A's capacity tables
              └── Sprint D (calendar UI)   ← depends on all prior data
```

---

## Quick Wins (Can Be Done Immediately Without Migrations)

1. **Add company blackout check to route generation** — queries existing `blackout_dates` table, zero schema changes
2. **Add `max_stops_per_tech` as a route generation parameter** — currently hardcoded; make it a request body param (admin can override per-day)
3. **Return "no available technicians" warning** — rather than creating empty routes
4. **Add tech availability status indicator to Employee list** — show "Scheduled today: YES/NO" based on day_of_week (even without templates, a simple "Mon–Fri" assumption can be coded)

These can be shipped while the database migrations for Sprint A are being planned.
