# Admin Notification Service Report

**Date:** 2026-05-30  
**File:** `server/services/notifications/adminNotificationService.ts`  
**Status:** IMPLEMENTED

## Public API

### `notifyAdmin(event: AdminAlertEvent): void`
Fire-and-forget. Deduplicates, sends email/SMS, logs to `admin_alerts`. Never throws.

### `notifyAdminCritical(event_type, title, details?): void`
Convenience wrapper for critical severity. Always triggers SMS when phone is configured.

### `logAdminAlert(event: AdminAlertEvent): Promise<string | null>`
Persists to DB only — no email or SMS. For info-level events that should appear in alert history.

## Internal Functions

| Function | Purpose |
|----------|---------|
| `resolveAdminRecipients()` | Reads OWNER_EMAIL, ADMIN_ALERT_EMAILS, OWNER_PHONE from env |
| `isDuplicateAlert()` | Queries admin_alerts for open alerts within dedup window |
| `insertAdminAlert()` | Writes row to admin_alerts table |
| `buildAdminAlertEmail()` | Returns branded HTML email template for admin |
| `sendAdminEmail()` | Loops over recipient emails, calls provider.send() |
| `sendAdminSms()` | Loops over phones, calls provider.send() |

## Design Decisions

- **Fire-and-forget**: `notifyAdmin` is synchronous to call but async internally — routes return immediately without waiting for email delivery
- **Fail-safe**: All errors caught in top-level async IIFE, logged but never propagated
- **Provider-agnostic**: Uses `getEmailProvider()` / `getSmsProvider()` — works with NullProviders when creds absent
- **SMS only on warning/critical**: Prevents SMS fatigue from high-volume info events like service completions
