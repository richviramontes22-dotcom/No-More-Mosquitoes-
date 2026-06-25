# Email Template System Report

**Date:** 2026-05-30

## Template File
`server/services/notifications/emailTemplates.ts`

## Design System
All templates use shared design tokens:
- Brand green: #2d6a4f
- Background: #f0faf4 (light), #f3f4f6 (page)
- Fonts: Georgia for headings, system sans-serif for body
- Consistent `layout()` wrapper with green header and branded footer

## Footer (Updated)
- Company name
- Company address (from `process.env.COMPANY_ADDRESS` — never hardcoded)
- Support email (from `process.env.SUPPORT_EMAIL`)
- Link to website
- Unsubscribe notice: "To unsubscribe from marketing emails, reply to this email with 'Unsubscribe'"

## Templates Built

| Function | Type | Has Text Fallback |
|----------|------|-------------------|
| `buildConfirmationEmail` | appointment_confirmation | No (legacy) |
| `buildReminder24hEmail` | reminder_24h | No (legacy) |
| `buildReminderSameDayEmail` | reminder_same_day | No (legacy) |
| `buildCancellationEmail` | appointment_canceled | No (legacy) |
| `buildRescheduleEmail` | appointment_rescheduled | No (legacy) |
| `buildServiceCompletionEmail` | service_completed | Yes |
| `buildPaymentFailedEmail` | payment_failed | Yes |
| `buildSubscriptionActivatedEmail` | subscription_activated | Yes |
| `buildSubscriptionCancelledEmail` | subscription_canceled | Yes |
| `buildSubscriptionRenewedEmail` | subscription_renewed | Yes |
| `buildAnnualPlanExpiringEmail` | annual_expiring_30d/7d | Yes |
| `buildAnnualPlanExpiredEmail` | annual_expired | Yes |
| `buildLeadAcknowledgementEmail` | lead_acknowledgement | Yes |
| `buildEnRouteFallbackEmail` | technician_en_route | Yes |

## Notes
- Legacy templates (confirmation, reminder, cancellation, reschedule) were not rewritten to avoid breaking existing callers. Footer updated in the shared `layout()` function so all templates benefit automatically.
- All new templates include plain text fallback.
