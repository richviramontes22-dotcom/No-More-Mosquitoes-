# Customer Communication Inventory
**No More Mosquitoes Platform — Communication Audit**
**Date: 2026-05-30**

---

## Summary

The platform currently supports **9 distinct communication events** across email and SMS channels, implemented across 6 server-side files and 3 Netlify scheduled functions. All communications are triggered server-side with logging to `notification_log`. No push notifications, in-app banners, or marketing automations exist.

---

## Communication Inventory

### 1. Appointment Confirmation Email

| Field | Detail |
|---|---|
| **Trigger Event** | Customer books an appointment via `POST /api/schedule` (authenticated) or Stripe `checkout.session.completed` webhook |
| **Delivery Method** | Email only |
| **Route / Function** | `server/routes/schedule.ts` → `sendAppointmentConfirmation()` in `server/services/notifications/sendAppointmentConfirmation.ts` |
| **Template Source** | Hardcoded HTML in `server/services/notifications/emailTemplates.ts` — `buildConfirmationEmail()`. Inline styles, brand green `#2d6a4f`, responsive layout. |
| **Customer Visibility** | Not surfaced in dashboard UI; customer sees appointment in `/dashboard/appointments` list but no "confirmation sent" indicator |
| **Admin Visibility** | Yes — appears in `notification_log` with `notification_type = 'appointment_confirmation'`; visible in `/admin/notifications` |
| **Status** | **Fully Implemented** |
| **Notes** | Duplicate prevention via `isDuplicateNotification()` using unique DB index on `(appointment_id, notification_type)` WHERE `status='sent'`. Includes: service type, date, arrival window, pre-service checklist, dashboard CTA. |

---

### 2. 24-Hour Reminder Email + SMS

| Field | Detail |
|---|---|
| **Trigger Event** | Daily at 07:00 UTC via Netlify scheduled function `send-reminders` |
| **Delivery Method** | Email (Resend) + SMS (Twilio) if customer has phone number and `smsReminders !== false` |
| **Route / Function** | `netlify/functions/send-reminders.ts` → `runReminderBatch(tomorrow, 'reminder_24h')` in `server/services/notifications/reminderScheduler.ts` |
| **Template Source** | Hardcoded HTML — `buildReminder24hEmail()` in `emailTemplates.ts`; SMS from `buildReminderSms()` in `smsTemplates.ts` |
| **Customer Visibility** | Not shown in dashboard UI |
| **Admin Visibility** | Yes — `notification_type = 'reminder_24h'`; visible in `/admin/notifications` |
| **Status** | **Fully Implemented** |
| **Notes** | SMS reminder does NOT log to `notification_log` (only email does via `sendAppointmentReminder()`). SMS errors are logged to `result.errors[]` but not persisted. Respects `profiles.notification_preferences.smsReminders` flag. |

---

### 3. Same-Day Reminder Email + SMS

| Field | Detail |
|---|---|
| **Trigger Event** | Daily at 07:00 UTC via Netlify `send-reminders` (same invocation as 24h) |
| **Delivery Method** | Email (Resend) + SMS (Twilio) if applicable |
| **Route / Function** | `netlify/functions/send-reminders.ts` → `runReminderBatch(today, 'reminder_same_day')` |
| **Template Source** | Hardcoded HTML — `buildReminderSameDayEmail()` in `emailTemplates.ts`; SMS from `buildReminderSms()` in `smsTemplates.ts` |
| **Customer Visibility** | Not shown in dashboard UI |
| **Admin Visibility** | Yes — `notification_type = 'reminder_same_day'`; visible in `/admin/notifications` |
| **Status** | **Fully Implemented** |
| **Notes** | Same-day reminder displays a prominent arrival window box in the email. Runs in `Promise.allSettled()` with 24h reminder so one failure doesn't block the other. |

---

### 4. Technician En-Route SMS

| Field | Detail |
|---|---|
| **Trigger Event** | Admin dispatches technician via `POST /api/admin/appointments/:id/dispatch` |
| **Delivery Method** | SMS only (Twilio) |
| **Route / Function** | `server/routes/adminAppointments.ts` → `sendEnRouteSMS()` in `server/services/notifications/sendEnRouteSMS.ts` |
| **Template Source** | Hardcoded text — `buildEnRouteSms()` in `smsTemplates.ts`. Plain text with arrival window, address, support phone |
| **Customer Visibility** | Not shown in dashboard UI |
| **Admin Visibility** | Yes — `notification_type = 'technician_enroute'`, `channel = 'sms'`; visible in `/admin/notifications` |
| **Status** | **Fully Implemented** (when Twilio is configured) |
| **Notes** | Silently skips if customer has no phone number; `skipReason` returned in API response so admin knows. Duplicate prevention via `isDuplicateNotification()`. If Twilio env vars are missing, logs `status='skipped'`. No email fallback for en-route. |

---

### 5. Appointment Cancellation Email

| Field | Detail |
|---|---|
| **Trigger Event** | Admin cancels via `PATCH /api/admin/appointments/:id/cancel`, OR `customer.subscription.deleted` Stripe webhook (cascades to future appointments — cancels them but does NOT send individual emails per appointment) |
| **Delivery Method** | Email only (Resend) |
| **Route / Function** | `server/routes/adminAppointments.ts` → direct Resend call with `buildCancellationEmail()` |
| **Template Source** | Hardcoded HTML — `buildCancellationEmail()` in `emailTemplates.ts`. Red heading, "Appointment Canceled", rebook CTA. |
| **Customer Visibility** | Not surfaced in dashboard beyond appointment status changing to "Canceled" |
| **Admin Visibility** | Yes — `notification_type = 'appointment_canceled'`; visible in `/admin/notifications` |
| **Status** | **Partially Implemented** |
| **Notes** | **Gap**: Cancellation email is ONLY sent when admin cancels via the admin API. When `customer.subscription.deleted` webhook cascades cancels future appointments (lines 596–634 of `webhooksStripe.ts`), NO email is sent to the customer. When a customer self-cancels (not yet implemented as a route), no email would be sent. |

---

### 6. Appointment Rescheduled Email

| Field | Detail |
|---|---|
| **Trigger Event** | Customer reschedules via `POST /api/appointments/:id/reschedule` |
| **Delivery Method** | Email only (Resend) |
| **Route / Function** | `server/routes/customerAppointments.ts` → direct Resend call with `buildRescheduleEmail()` |
| **Template Source** | Hardcoded HTML — `buildRescheduleEmail()` in `emailTemplates.ts`. New date, new window, dashboard CTA. |
| **Customer Visibility** | Dashboard shows updated appointment date/time immediately |
| **Admin Visibility** | Yes — `notification_type = 'appointment_rescheduled'`; visible in `/admin/notifications` |
| **Status** | **Fully Implemented** |
| **Notes** | No SMS sent on reschedule. No duplicate prevention (no `isDuplicateNotification()` call) — the same appointment can receive multiple reschedule emails if rescheduled multiple times, which is correct behavior. |

---

### 7. Service Completion Email

| Field | Detail |
|---|---|
| **Trigger Event** | Employee marks assignment `completed` via `POST /api/employee/assignments/:id/status` |
| **Delivery Method** | Email only (Resend) |
| **Route / Function** | `server/routes/employeeAssignments.ts` (lines 231–299) — inline Resend call; NOT using a shared template function |
| **Template Source** | **Hardcoded inline HTML string** directly in the route handler — NOT in `emailTemplates.ts`. No shared template, no `buildXxx()` function. |
| **Customer Visibility** | Appointment status changes to "Completed" in dashboard. If job media was attached, note in email references dashboard. |
| **Admin Visibility** | Yes — `notification_type = 'service_completed'`; visible in `/admin/notifications`. **Note**: `service_completed` was added to the CHECK constraint via migration `2026-05-29_notification_type_service_completed.sql` |
| **Status** | **Partially Implemented** |
| **Notes** | Email quality is significantly lower than the themed template emails — just raw `<p>` tags with no brand styling. No preheader, no CTA button component, no brand header. The TYPE_LABELS map in `Notifications.tsx` does NOT include `service_completed` — so it shows raw DB value in the admin notification log instead of a human label. |

---

### 8. Employee Assignment Notification Email

| Field | Detail |
|---|---|
| **Trigger Event** | Admin assigns employee(s) to appointment(s) via `POST /api/admin/assignments` |
| **Delivery Method** | Email only (Resend) |
| **Route / Function** | `server/routes/adminAppointments.ts` (lines 270–290) — inline Resend call |
| **Template Source** | **Hardcoded inline HTML string** in route handler — NOT in `emailTemplates.ts`. Plain paragraph text only. |
| **Customer Visibility** | N/A — this goes to the employee, not the customer |
| **Admin Visibility** | NOT logged to `notification_log` — no `logNotification()` call. |
| **Status** | **Partially Implemented** |
| **Notes** | Email is employee-facing, not customer-facing. Not logged. Very minimal content: just "You have been assigned X appointments." No link to the employee portal. No schedule details in the email body. |

---

### 9. Annual Plan Expiration Alert (Internal)

| Field | Detail |
|---|---|
| **Trigger Event** | Daily at 09:00 UTC via Netlify `expire-annual-plans` when `subscriptions.current_period_end < now()` |
| **Delivery Method** | None to customer — creates an admin `tickets` record only |
| **Route / Function** | `netlify/functions/expire-annual-plans.ts` |
| **Template Source** | N/A — no email sent |
| **Customer Visibility** | None — customer is NOT notified their annual plan has expired |
| **Admin Visibility** | Ticket created in `tickets` table with subject "Annual plan expired: subscription {id}" |
| **Status** | **Partially Implemented** |
| **Notes** | **Critical gap**: Customer receives zero communication when their annual plan expires. They should receive a renewal reminder email 30 days before expiration and an expiration notice on the day it expires. |

---

## Channel Summary

| Channel | Provider | Configured By | Number of Uses |
|---|---|---|---|
| Email | Resend | `RESEND_API_KEY` env var | 7 events |
| SMS | Twilio | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` env vars | 2 events (en-route + reminders) |
| Push | None | — | 0 events |
| In-App | None | — | 0 events |

---

## Notification Type Coverage in Database

The `notification_log.notification_type` CHECK constraint (after migration `2026-05-29`) allows:
- `appointment_confirmation` — USED
- `reminder_24h` — USED
- `reminder_same_day` — USED
- `appointment_canceled` — USED
- `appointment_rescheduled` — USED
- `technician_enroute` — USED
- `service_completed` — USED
- `appointment_canceled_employee` — DEFINED, NOT USED
- `appointment_canceled_customer` — DEFINED, NOT USED
- `scheduling_failure` — DEFINED, NOT USED
- `payment_failed` — DEFINED, NOT USED
- `subscription_canceled` — DEFINED, NOT USED
- `logged` — DEFINED, NOT USED

**5 notification types are defined in the schema but have zero implementation.**

---

## Admin Notification Log UI Coverage Gap

`TYPE_LABELS` in `client/pages/admin/Notifications.tsx` only maps 6 types:
- `appointment_confirmation`, `reminder_24h`, `reminder_same_day`, `appointment_canceled`, `appointment_rescheduled`, `technician_enroute`

**Missing from UI labels**: `service_completed` — will display raw value in the admin table.
