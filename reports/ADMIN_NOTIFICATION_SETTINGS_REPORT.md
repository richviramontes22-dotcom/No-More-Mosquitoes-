# Admin Notification Settings Report

**Date:** 2026-05-30  
**Status:** COMPLETE

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|---------|
| `OWNER_EMAIL` | Primary alert recipient email | Recommended |
| `OWNER_PHONE` | Owner mobile for SMS alerts (warning/critical) | Optional |
| `ADMIN_ALERT_EMAILS` | Comma-separated fallback list if OWNER_EMAIL not set | Optional |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for SMS | Optional |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Optional |
| `TWILIO_FROM_NUMBER` | Twilio sender number (+1...) | Optional |
| `RESEND_API_KEY` | Email delivery via Resend | Optional |

## Fallback Behavior

- No `OWNER_EMAIL` + no `ADMIN_ALERT_EMAILS`: NullEmailProvider — logs intent, no email sent
- No Twilio credentials: NullSmsProvider — logs intent, no SMS sent
- Alert still persists to `admin_alerts` table in all cases

## Severity → Channel Matrix

| Severity | Email | SMS |
|---------|-------|-----|
| info | ✅ (if configured) | ❌ |
| warning | ✅ (if configured) | ✅ (if phone + Twilio configured) |
| critical | ✅ (if configured) | ✅ (if phone + Twilio configured) |

## Deduplication Settings

- Default window: 60 minutes for info/warning
- Critical window: 15 minutes (more aggressive retry detection)
- Deduplication key: `event_type + entity_type + entity_id` among unresolved alerts
