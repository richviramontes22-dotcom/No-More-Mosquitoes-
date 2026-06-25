# Admin Lead & Customer Alerts Report

**Date:** 2026-05-30  
**Status:** PARTIALLY IMPLEMENTED

## Implemented

### leads.new_schedule_request (via `schedule.ts`)
When a prospect submits a schedule request form, the owner is notified immediately with:
- Full name, email, phone
- ZIP code and service type
- Entity link: schedule_request UUID

## Lead Lifecycle Alerting

The complete lead → customer conversion funnel:

| Step | Alert | Status |
|------|-------|--------|
| Form submitted | `leads.new_schedule_request` (info) | ✅ Implemented |
| First appointment created | Not yet hooked | ⬜ Future |
| Payment completed | `billing.new_subscription` (info) | ✅ Implemented |
| First service completed | `field_ops.service_completed` (info) | ✅ Implemented |
| Customer churns | `subscriptions.cancelled` (warning) | ✅ Implemented |

## Alert Volume Estimate

Based on typical pest control business:
- Schedule requests: 2–10/day in season
- New subscriptions: 1–5/day peak season
- Service completions: 5–20/day in season

With info-severity email-only (no SMS), alert volume should be manageable. If email volume becomes excessive, the `severity: "info"` events can be switched to `logAdminAlert()` (DB-only, no email) without any route changes.

## Future Customer Alerts

| Event | Severity |
|-------|---------|
| New customer account created | info |
| Customer profile updated | info |
| Customer added new property | info |
| Customer support message received | warning |
