# Workforce Admin Notification Report
**Date:** 2026-06-01

---

## Admin Alerts Implemented

| Event | Severity | Where |
|-------|----------|-------|
| `workforce.no_technicians_available` | critical | `POST /api/admin/routes/day/generate` when all techs excluded |

### `workforce.no_technicians_available`
Fires when `technicians.length === 0` after filtering for availability on the requested date.

Title: `"No technicians available for [date]"`
Body: `"All active technicians are unavailable on [date]. Routes cannot be generated."`
Metadata: `{ date, excluded_count: N }`

This is fire-and-forget via the existing `notifyAdmin()` service. The route still returns a 200 with the error explanation even if the notification fails.

---

## Admin Alerts NOT Yet Implemented (Deferred to Sprint B)

| Event | Severity | Trigger |
|-------|----------|---------|
| `workforce.technician_over_capacity` | warning | Route stops exceed technician capacity |
| `workforce.route_blocked_validation` | critical | Publish blocked by critical validation error |
| `workforce.missing_schedule_profiles` | warning | Technicians without schedules in overview |
| `workforce.blackout_conflict` | warning | Route exists for date with blackout |

These are low-risk to defer because:
1. The validation gate on publish provides the blocking behavior without the notification
2. The Workforce Hub shows missing profiles visually
3. The route planner shows excluded technicians in the generate response

Sprint B will wire these events using the same `notifyAdmin()` pattern.

---

## Employee Notifications (Not Yet Implemented)

No employee-facing notifications for schedule or capacity changes are implemented in Sprint A. The employee only sees their schedule via the future `/employee/schedule` page (Sprint B). Admin changes to schedules take effect silently for now.
