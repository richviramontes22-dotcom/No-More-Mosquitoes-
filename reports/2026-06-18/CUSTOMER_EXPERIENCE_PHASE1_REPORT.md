# Customer Experience Phase 1 — Implementation Report
**Date:** 2026-06-18

## What Was Built

| Piece | File |
|---|---|
| Schema | `db/migrations/2026-06-18_customer_experience_phase1.sql` — `appointment_reschedule_requests`, `customer_notification_settings` |
| Reschedule request service | `server/services/appointments/rescheduleRequestService.ts` |
| Customer API | `customerAppointments.ts` — `POST /appointments/:id/reschedule-request`, `GET /appointments/reschedule-requests` |
| Admin API | `adminAppointments.ts` — `GET/POST .../reschedule-requests*`; `adminSettings.ts` — `GET/PATCH .../notification-settings` |
| Notification settings service | `server/services/notifications/notificationSettingsService.ts` |
| 2h reminder | `reminderScheduler.ts` (`run2hReminderBatch`), `emailTemplates.ts` (`buildReminder2hEmail`), `netlify/functions/send-reminders-2h.ts` (new, every 30 min), `netlify.toml` |
| Review request | `emailTemplates.ts` (`buildReviewRequestEmail`), hook in `employeeAssignments.ts` completion handler |
| Admin UI | `client/pages/admin/RescheduleRequests.tsx` (new page + nav entry), `client/pages/admin/Notifications.tsx` (settings card) |
| Customer UI | `client/pages/dashboard/Appointments.tsx` — "Request a different date" link inside the existing `RescheduleDialog` |

## (A) Reschedule Requests — Additive, Not a Replacement

The audit (`PLATFORM_GROWTH_PHASE2_AUDIT.md`) flagged a critical finding before any code was written: an instant, self-service reschedule already ships live (`POST /api/appointments/:id/reschedule` in `customerAppointments.ts`, wired to the existing `RescheduleDialog`). Building a "request + approval" flow as a literal replacement would have removed working functionality the spec never asked to remove.

What was built instead sits alongside it:
- Customer dashboard: inside the existing reschedule dialog, a new link — *"Don't see a date that works? Request a different one"* — opens a second, simpler dialog (`RescheduleRequestDialog`) that takes a preferred date, window preference, and optional reason, and posts to the new `reschedule-request` endpoint. This only ever inserts a row into `appointment_reschedule_requests` with `status: 'pending'` — it never touches the appointment.
- Admin: a new **Reschedule Requests** page (`/admin/reschedule-requests`, added to the Field Operations nav group) lists pending requests with Approve/Deny actions. Approve opens a small dialog to confirm/adjust the final date+window, which calls `approveRescheduleRequest()` — this is the only code path that updates the appointment (`scheduled_date`, `window`, `window_label`, `scheduled_at`, `status`), and it reuses the exact same `buildRescheduleEmail` template and `appointment_rescheduled` notification type the instant path already uses, so the customer-facing email is indistinguishable regardless of which path produced the change. Deny sends a short notice email and leaves the original appointment untouched.

Admin approval does not re-run the capacity/availability check the instant endpoint runs (`checkWindowAvailability` in `customerAppointments.ts`) — approving is treated as an explicit admin decision, made after looking at the calendar, not a second automated booking attempt.

## (B) Service Reminders — Email Only

- **24h reminder** — unchanged in behavior. Added one new check: `customer_notification_settings.reminder_24h_enabled` (default `true`, matching today's live behavior) is read in addition to the existing `ENABLE_REMINDER_EMAILS` env flag. Both must allow a send.
- **2h reminder** — new, default **disabled**. Unlike the 24h/same-day reminders (which scan "every appointment scheduled on date X" once a day), 2-hour-before needs clock-time precision, so `run2hReminderBatch()` scans a rolling 1h45m–2h15m window against `appointments.scheduled_at` (confirmed this field is populated from the window's actual start time at booking/reschedule time — see `schedule.ts:294`) and runs every 30 minutes via a new scheduled function, `send-reminders-2h.ts`. No SMS — email only, per the constraint.
- Both reminder types share the existing `isDuplicateNotification` guard via `sendAppointmentReminder()`, so the new 30-minute cadence cannot double-send within the same appointment.

## (C) Review Request — Email Only

Hooked directly into the existing service-completion code path in `employeeAssignments.ts` (the same `if (status === "completed" && !actor.isTest)` block that sends the completion email), as a sibling fire-and-forget action — one failing doesn't block the other. Gated by:
1. `customer_notification_settings.review_request_enabled` (default `false`)
2. A configured `review_link_url` (no link configured = no send, regardless of the toggle)
3. `isDuplicateNotification(appointmentId, "review_request")` — guarantees at most one review-request email ever, per appointment, even if completion status is toggled back and forth.

The admin-configurable review link and all three toggles live in one place: the new "Customer Notification Settings" card at the top of `/admin/notifications`.

## Validation

`pnpm typecheck` and `pnpm test` (72/72) pass after every step of this phase.
