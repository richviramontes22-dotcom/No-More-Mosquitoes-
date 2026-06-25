# Email System Audit
**Date:** 2026-06-03
**Method:** Direct source code inspection

---

## Existing Provider Architecture

**File:** `server/services/notifications/resendClient.ts`
- Resend SDK initialized lazily on first call
- `getResendClient()` returns null if `RESEND_API_KEY` not set
- `getFromEmail()` defaults to `"No More Mosquitoes <hello@nomoremosquitoes.us>"`
- `isEmailConfigured()` → boolean

**File:** `server/services/notifications/providers/index.ts`
- `getEmailProvider()` → `ResendEmailProvider` if configured, `NullEmailProvider` if not
- `NullEmailProvider` logs intent but never crashes the application
- **Email failures NEVER break business workflows** — guaranteed by NullProvider

---

## Existing Templates (emailTemplates.ts) — 16 Templates

| Template | Function | Trigger Status |
|----------|----------|---------------|
| `appointment_confirmation` | `buildConfirmationEmail` | ✅ Wired (webhook + now confirm-booking) |
| `reminder_24h` | `buildReminder24hEmail` | ✅ Wired (send-reminders function) |
| `reminder_same_day` | `buildReminderSameDayEmail` | ✅ Wired (send-reminders function) |
| `appointment_canceled` | `buildCancellationEmail` | ✅ Wired (customerAppointments.ts) |
| `appointment_rescheduled` | `buildRescheduleEmail` | ✅ Wired (customerAppointments.ts) |
| `service_completed` | `buildServiceCompletionEmail` | ✅ Wired (employeeAssignments.ts) |
| `payment_failed` | `buildPaymentFailedEmail` | ✅ Wired (webhooksStripe.ts invoice.payment_failed) |
| `subscription_activated` | `buildSubscriptionActivatedEmail` | ✅ Wired (webhooksStripe.ts invoice.paid) |
| `subscription_cancelled` | `buildSubscriptionCancelledEmail` | ✅ Wired (webhooksStripe.ts subscription.deleted) |
| `subscription_renewed` | `buildSubscriptionRenewedEmail` | ✅ Wired (webhooksStripe.ts invoice.paid renewal) |
| `annual_plan_expiring` | `buildAnnualPlanExpiringEmail` | ✅ Wired (send-annual-warnings function) |
| `annual_plan_expired` | `buildAnnualPlanExpiredEmail` | ✅ Wired (send-annual-warnings function) |
| `lead_acknowledgement` | `buildLeadAcknowledgementEmail` | ✅ Wired (schedule.ts lead capture) |
| `technician_en_route` | `buildEnRouteFallbackEmail` | ✅ Wired (employeeAssignments.ts) |
| `employee_assignment` | `buildEmployeeAssignmentEmail` | ✅ Wired (employeeNotificationService.ts) |
| `welcome_email` | `buildWelcomeEmail` | ⚠ Template exists, trigger not yet wired (see gaps) |

---

## Existing Triggers

| Trigger Location | Email Sent |
|-----------------|-----------|
| `webhooksStripe.ts` checkout.session.completed | appointment_confirmation (marketplace only) |
| `webhooksStripe.ts` invoice.paid | subscription_activated OR subscription_renewed |
| `webhooksStripe.ts` invoice.payment_failed | payment_failed |
| `webhooksStripe.ts` customer.subscription.deleted | subscription_cancelled |
| `server/routes/customerAppointments.ts` | appointment_canceled, appointment_rescheduled |
| `server/routes/employeeAssignments.ts` | service_completed, technician_en_route |
| `server/routes/billingStripe.ts confirm-booking` | appointment_confirmation (**FIXED IN THIS SPRINT**) |
| `netlify/functions/send-reminders.ts` | reminder_24h, reminder_same_day |
| `netlify/functions/send-annual-warnings.ts` | annual_plan_expiring, annual_plan_expired |
| `server/routes/schedule.ts` | lead_acknowledgement |
| `server/services/notifications/employeeNotificationService.ts` | employee_assignment |

---

## Gaps Found

| Gap | Severity | Fix |
|-----|----------|-----|
| `confirm-booking` didn't send appointment confirmation | HIGH | **FIXED** — added in this sprint |
| Welcome email has no trigger for Supabase-managed signups | MEDIUM | Template exists; best triggered via subscription_activated for paying customers |
| Admin "new customer" notification uses alert system, not email | LOW | OK — admin_alerts table + OWNER_EMAIL covers this |

---

## Notification Logger

**File:** `server/services/notifications/notificationLogger.ts`
- Every sent/failed/skipped email logged to `notification_log` table
- Duplicate prevention via `isDuplicateNotification(appointmentId, type)`
- 35+ notification types in the TypeScript union
