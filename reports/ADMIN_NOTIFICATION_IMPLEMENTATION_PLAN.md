# Admin / Owner Notification System — Implementation Plan

**Date:** 2026-05-30  
**Status:** IMPLEMENTED

## Objective

Build an internal alert and notification system that keeps the business owner and admin users informed of operationally significant events without requiring them to poll dashboards manually.

## Architecture

```
Event source (webhook / route / scheduler)
        │
        ▼
notifyAdmin(event)  ──── dedup check ──── insertAdminAlert()
        │
        ├── sendAdminEmail()  ← ResendEmailProvider / NullEmailProvider
        └── sendAdminSms()    ← TwilioSmsProvider / NullSmsProvider
```

## Phases

| Phase | Component | Status |
|-------|-----------|--------|
| 1 | `adminNotificationService.ts` | ✅ Done |
| 2 | `admin_alerts` DB migration | ✅ Done |
| 3 | `adminAlerts.ts` REST API | ✅ Done |
| 4 | Billing webhook hooks | ✅ Done |
| 5 | Schedule / lead hooks | ✅ Done |
| 6 | Field ops (service completion) hooks | ✅ Done |
| 7 | `.env.example` updates | ✅ Done |

## Event Taxonomy

| Domain | Event Type | Severity |
|--------|-----------|---------|
| Billing | billing.payment_failed | critical |
| Billing | billing.new_subscription | info |
| Subscriptions | subscriptions.cancelled | warning |
| Leads | leads.new_schedule_request | info |
| Field Ops | field_ops.service_completed | info |

## Recipient Resolution

Priority: `OWNER_EMAIL` env var → `ADMIN_ALERT_EMAILS` comma list → no email (NullProvider logs)

SMS sent only for warning and critical severity when `OWNER_PHONE` + Twilio credentials are configured.
