# Email Compliance Report

**Date:** 2026-05-30

## CAN-SPAM Compliance

### Unsubscribe Notice
All emails include in the footer:
> "To unsubscribe from marketing emails, reply to this email with 'Unsubscribe'"

### Physical Address
Footer includes `process.env.COMPANY_ADDRESS` — reads from environment, never hardcoded. Admins must set `COMPANY_ADDRESS` in production.

### From Address
Configured via `RESEND_FROM_EMAIL` env var. Default: `No More Mosquitoes <hello@nomoremosquitoes.us>`.

### Support Contact
Footer shows support email from `process.env.SUPPORT_EMAIL`.

## Email Categories
- **Transactional** (appointment confirmations, reminders, service completion, payment receipts): Do not require unsubscribe per CAN-SPAM, but unsubscribe notice included for consistency
- **Marketing/Lifecycle** (subscription activation welcome, annual renewal prompts): Full CAN-SPAM footer required — implemented

## Template Audit

| Template | Has Footer | Has Unsubscribe | Has Address |
|----------|-----------|-----------------|-------------|
| buildConfirmationEmail | Yes | Yes | Yes (env) |
| buildReminder24hEmail | Yes | Yes | Yes (env) |
| buildReminderSameDayEmail | Yes | Yes | Yes (env) |
| buildCancellationEmail | Yes | Yes | Yes (env) |
| buildRescheduleEmail | Yes | Yes | Yes (env) |
| buildServiceCompletionEmail | Yes | Yes | Yes (env) |
| buildPaymentFailedEmail | Yes | Yes | Yes (env) |
| buildSubscriptionActivatedEmail | Yes | Yes | Yes (env) |
| buildSubscriptionCancelledEmail | Yes | Yes | Yes (env) |
| buildSubscriptionRenewedEmail | Yes | Yes | Yes (env) |
| buildAnnualPlanExpiringEmail | Yes | Yes | Yes (env) |
| buildAnnualPlanExpiredEmail | Yes | Yes | Yes (env) |
| buildLeadAcknowledgementEmail | Yes | Yes | Yes (env) |
| buildEnRouteFallbackEmail | Yes | Yes | Yes (env) |

All 14 templates share the same `layout()` function footer — compliance is inherited automatically.
