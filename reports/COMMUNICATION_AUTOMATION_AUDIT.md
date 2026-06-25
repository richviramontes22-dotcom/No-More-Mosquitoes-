# Communication Automation Audit
**No More Mosquitoes Platform — Automation Coverage and Gaps**
**Date: 2026-05-30**

---

## Executive Summary

The platform has 5 automated communication triggers. Of these, 4 are fully automated (running on schedule or event hooks with no human intervention), and 1 requires manual admin action (dispatch). All are appointment-focused. Billing events, subscription events, and all marketing automations are absent.

---

## Active Automated Communication Triggers

### 1. Daily Reminder Batch — Netlify Scheduled Function

**File**: `netlify/functions/send-reminders.ts`
**Schedule**: `0 7 * * *` (07:00 UTC daily, via `netlify.toml`)
**What It Does**:
- Calls `runReminderBatch(tomorrow, 'reminder_24h')` for all non-canceled appointments scheduled tomorrow
- Calls `runReminderBatch(today, 'reminder_same_day')` for all non-canceled appointments scheduled today
- Both run in `Promise.allSettled()` — neither blocks the other on failure

**Automation Quality**:
- Duplicate prevention via `isDuplicateNotification()` prevents double-sends on scheduler retry
- `REMINDER_DRY_RUN=true` env var for staging validation
- Batch-fetches profiles and properties in 2 queries before looping (efficient)
- Sends both email (via `sendAppointmentReminder()`) and SMS (direct Twilio call in `reminderScheduler.ts` lines 137–162)

**Gaps**:
- No admin alert if the entire Netlify function fails to execute (silent cron failure)
- SMS reminders bypass `logNotification()` — not tracked in `notification_log`
- If a customer's appointment is created after 07:00 UTC on the same day, they miss the same-day reminder
- No retry for individual failed email/SMS sends beyond the next daily run

---

### 2. Recurring Appointment Generation — Netlify Scheduled Function

**File**: `netlify/functions/generate-appointments.ts`
**Schedule**: `0 8 * * *` (08:00 UTC daily)
**What It Does**: Calls `runRecurringGeneration()` to generate next appointments for active subscriptions within the 7-day advance window.

**Communication Gap**: When a new recurring appointment is generated, **no notification is sent to the customer**. The customer must log in to discover their next visit has been scheduled. This is a silent UX gap in the subscription promise: customers pay for automatic recurring treatment but never learn when the next one is coming unless they check the dashboard.

---

### 3. Annual Plan Expiration — Netlify Scheduled Function

**File**: `netlify/functions/expire-annual-plans.ts`
**Schedule**: `0 9 * * *` (09:00 UTC daily)
**What It Does**: Marks expired annual subscriptions and creates admin `tickets` table rows.

**Communication Gaps**:
- Zero customer notification on expiration
- No proactive pre-expiration reminder (30 or 7 days before)
- Customer discovers expired plan only by attempting to use the service

---

### 4. Appointment Confirmation — Event-Triggered

**Trigger**: `POST /api/schedule` with authenticated `userId` and valid `propertyId`
**Handler**: `sendAppointmentConfirmation()` via `sendConfirmationForAppointment()` in `server/routes/schedule.ts` (lines 215–229)
**Quality**: Fires immediately after DB insert. Non-blocking (`.catch()` wrapper). Duplicate-protected via `isDuplicateNotification()`.

**Critical Gap**: When `checkout.session.completed` in `webhooksStripe.ts` creates a first appointment (lines 274–313), `sendAppointmentConfirmation()` is NOT called. Subscription customers who book through the Stripe checkout flow do NOT receive a confirmation email. Only customers booking via `/api/schedule` receive one.

---

### 5. Technician En-Route SMS — Semi-Automated (Requires Admin Dispatch)

**Trigger**: `POST /api/admin/appointments/:id/dispatch` (admin manual action)
**Handler**: `sendEnRouteSMS()` in `server/routes/adminAppointments.ts` (lines 121–133)
**Quality**: Fires immediately. Non-blocking. Duplicate-protected. Logs to `notification_log`.

**Gaps**:
- Requires manual admin dispatch — NOT automatically triggered when employee sets their own status to `en_route` via `POST /api/employee/assignments/:id/status`
- If an employee marks themselves en-route without admin dispatch, no SMS is sent
- No email fallback for customers without a phone number

---

### 6. Service Completion Email — Event-Triggered

**Trigger**: `POST /api/employee/assignments/:id/status` with `status = 'completed'`
**Handler**: Inline async block in `server/routes/employeeAssignments.ts` (lines 231–299)
**Quality**: Fires immediately. Non-blocking.

**Gaps**:
- No duplicate protection (`isDuplicateNotification()` not called)
- Uses inline HTML instead of branded `layout()` template
- `logNotification()` not called — uses raw `db.from("notification_log").insert()` with `.catch(() => {})` (silent error swallow)
- No SMS notification on completion
- `notification_type: 'service_completed'` was not in the original CHECK constraint (fixed by migration `2026-05-29_notification_type_service_completed.sql`)

---

## Missing Automations — Priority Matrix

### Priority 1: Revenue Protection (Missing — Critical)

| Missing Automation | Trigger Source | Effort |
|---|---|---|
| Payment failed email | `invoice.payment_failed` webhook in `webhooksStripe.ts` | Low |
| Subscription canceled email | `customer.subscription.deleted` webhook in `webhooksStripe.ts` | Low |
| Annual plan pre-expiration (30-day) | Extend `expire-annual-plans.ts` | Low |
| Annual plan expired email | Extend `expire-annual-plans.ts` | Low |

---

### Priority 2: Customer Trust (Missing — High Impact)

| Missing Automation | Trigger Source | Effort |
|---|---|---|
| Subscription activated email | `invoice.paid` webhook (first payment) | Low |
| Appointment confirmation via Stripe checkout | `checkout.session.completed` webhook | Low |
| Recurring appointment scheduled notification | Extend `generate-appointments.ts` | Low |
| Auto en-route SMS when employee self-dispatches | Extend `employeeAssignments.ts` status=en_route handler | Low |

---

### Priority 3: Compliance (Missing — Legal Risk)

| Missing Automation | Trigger Source | Effort |
|---|---|---|
| Email unsubscribe processing | New `GET /api/unsubscribe/:token` route | Medium |
| SMS STOP handler | New `POST /api/webhooks/sms` Twilio inbound route | Medium |
| Unsubscribe link in all emails | Edit `emailTemplates.ts` layout() footer | Low |

---

### Priority 4: Post-Beta (Marketing — Missing)

| Missing Automation | Trigger Source | Effort |
|---|---|---|
| Post-service NPS survey (72h delay) | New Netlify function or webhook + delay queue | High |
| Renewal campaign for annual plans | New Netlify function | Medium |
| Inactive customer win-back (90 days) | New Netlify function | Medium |
| Seasonal mosquito alert batch email | New campaign system | High |
| Lead acknowledgment email | Extend `POST /api/schedule` | Low |

---

## Automation Architecture Gaps

### No Retry Queue

When Resend or Twilio returns an error, the failure is logged to `notification_log` but no retry is attempted. The only "retry" mechanism is the duplicate-prevention check — if a send is marked `failed` (not `sent`), the scheduler will attempt it again on the next daily run. However, for event-triggered notifications (confirmation, completion, cancellation), there is no retry at all. A failed confirmation email is simply lost.

**Recommendation**: Add a `pending` retry sweep — a Netlify function or DB trigger that re-queues notifications in `failed` status that are less than 48 hours old.

### No Alerting on Scheduler Failure

If `send-reminders.ts` throws a fatal error (e.g., Supabase unreachable), Netlify marks the function invocation as failed but nothing alerts the owner. The next day's invocation will run normally but the missed day's reminders are gone.

**Recommendation**: Add a `POST /api/admin/alerts` call or email via Resend to `hello@nomoremosquitoes.us` if the batch result has `failed > 0` or `errors.length > 0`.

### No Idempotency in Completion Email

`employeeAssignments.ts` completion handler (lines 285–293) inserts directly to `notification_log` without calling `isDuplicateNotification()`. If an employee accidentally marks a job complete twice (UI bug, double-tap), two completion emails are sent. The DB insert would fail on the second attempt due to the unique index, but the email is sent before the log insert — so the customer receives two emails.

**Recommendation**: Check `isDuplicateNotification(appointmentId, 'service_completed')` before sending the completion email.
