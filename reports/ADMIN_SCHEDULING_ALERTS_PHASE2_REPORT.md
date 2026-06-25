# Admin Scheduling Alerts — Phase 2 Report
**Date:** 2026-05-30
**Phase:** 4 — Admin Scheduling Alerts

## Summary
Three scheduling alert event types wired to fire `notifyAdmin()` on relevant scheduling events.

## Events Implemented

### 1. `scheduling.appointment_cancelled` (warning)
**File:** `server/routes/adminAppointments.ts`
**Trigger:** PATCH /api/admin/appointments/:id/cancel — after successful DB cancel
**Details:**
- Severity: warning
- Title: "Appointment cancelled by admin — {appointmentId_prefix}"
- Body: includes customer email
- Entity: appointment / appointment_id

### 2. `scheduling.appointment_rescheduled` (info)
**File:** `server/routes/customerAppointments.ts`
**Trigger:** POST /api/appointments/:id/reschedule — after successful DB update
**Details:**
- Severity: info
- Title: "Appointment rescheduled by customer — {new_date}"
- Body: includes appointment ID and new window
- Entity: appointment / appointment_id

### 3. `scheduling.appointment_created_without_assignment` (info)
**File:** `server/routes/webhooksStripe.ts`
**Trigger:** checkout.session.completed → first appointment creation block
**Details:**
- Severity: info
- Title: "New appointment needs assignment — {date}"
- Body: includes date, window, user_id, property_id
- Entity: user / user_id
- Fires immediately when the appointment is inserted so admin knows to assign a technician

## Files Modified

| File | Change |
|------|--------|
| `server/routes/adminAppointments.ts` | Added notifyAdmin import + cancel alert |
| `server/routes/customerAppointments.ts` | Added notifyAdmin import + reschedule alert |
| `server/routes/webhooksStripe.ts` | Added "created without assignment" alert |

## Deduplication
All three alerts use the default 60-minute dedup window for info/warning. If the same appointment is cancelled twice (e.g., webhook retry), the second alert is suppressed.

## Out of Scope (Future Work)
- `scheduling.appointment_overdue` — would require a cron job to detect overdue appointments
- Admin-initiated reschedule alert — no admin reschedule endpoint exists yet; route only used for customer self-reschedule
