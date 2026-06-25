# Appointment System Verification
**Date:** 2026-06-07

---

## Availability Calculation

| Check | Status | Evidence |
|-------|--------|---------|
| GET /api/availability endpoint | ✅ | availability.ts |
| Blackout dates respected | ✅ | blackout_dates table queried |
| Business hours respected | ✅ | business_hours table queried |
| Window capacity enforced | ✅ | max_jobs_per_tech vs active appointments |
| 45-day window loaded | ✅ | ScheduleFlow fetchAvailability(days=45) |
| Calendar highlights available days | ✅ | availabilityMap in ScheduleFlow |
| Fully-booked windows hidden | ✅ | available: false in response |

---

## Availability Preferences Model

| Check | Status | Evidence |
|-------|--------|---------|
| Preferred days of week selectable | ✅ | ScheduleFlow availability step |
| Preferred windows selectable | ✅ | morning / afternoon |
| Flexibility tolerance (0/1/2/99 days) | ✅ | flexibilityDays state |
| Preferences treated as preferences not constraints | ✅ | Calendar shows all available days; prefs are a guide |
| Preferences persisted to property | ✅ | confirm-booking → properties.update() |
| Preferences stored in Stripe metadata | ✅ | meta.pref_days, pref_windows |

---

## Appointment Creation

| Check | Status | Evidence |
|-------|--------|---------|
| Appointment created in confirm-booking | ✅ | Supabase insert |
| Idempotency: dedup by user+property+date | ✅ | Count check before insert |
| Status set to "scheduled" | ✅ | status: "scheduled" |
| scheduled_at timestamp populated | ✅ | windowStart or 08:00 fallback |
| window + window_label stored | ✅ | Appointment fields |
| Notes stored | ✅ | notes field |

---

## Appointment Reschedule

| Check | Status | Evidence |
|-------|--------|---------|
| PATCH /api/customer/appointments/:id | ✅ | customerAppointments.ts |
| Window availability re-checked | ✅ | checkWindowAvailability() |
| Blackout date checked | ✅ | Same function |
| Business hours checked | ✅ | day_of_week validation |
| Reschedule email sent | ✅ | buildRescheduleEmail() |
| Admin alert on reschedule | ✅ | notifyAdmin() |

---

## Appointment Cancellation

| Check | Status | Evidence |
|-------|--------|---------|
| Customer can cancel | ✅ | customerAppointments.ts DELETE/PATCH |
| Admin can cancel | ✅ | adminAppointments.ts |
| Employee assignment nullified | ✅ | ON DELETE SET NULL cascade |
| Cancellation email sent | ✅ | buildCancellationEmail() |
| Admin alert fired | ✅ | notifyAdmin() |

---

## Recurring Appointment Generation

| Check | Status | Evidence |
|-------|--------|---------|
| generate-appointments Netlify function | ✅ | netlify/functions/generate-appointments.ts |
| Runs daily at 8AM UTC | ✅ | netlify.toml schedule |
| Based on cadence_days | ✅ | generateRecurring.ts |
| Only for active subscriptions | ✅ | status=active filter |

---

## Scheduling Model — Confirmed Design

The system uses a **preference-first** model:

1. Customer selects preferred days/windows/flexibility during onboarding
2. Customer picks a specific date+window for their FIRST appointment
3. Recurring appointments are generated based on cadence
4. Admin reviews and dispatches via route planner
5. Employee confirms on day-of

**This is correct for a service business** — the "appointment" is an admin-dispatched event, not a real-time self-booking.

---

## Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No real-time slot conflict prevention for concurrent bookings | LOW | Capacity check is eventually consistent; low risk at beta scale |
| Reschedule does not clear the old appointment confirmation email | LOW | Customer gets new reschedule email; original confirmation stays in inbox |
| generate-appointments doesn't check technician availability | MEDIUM | Workforce Sprint B fix |
