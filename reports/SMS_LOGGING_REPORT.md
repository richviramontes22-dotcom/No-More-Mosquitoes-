# SMS Logging Report

**Date:** 2026-05-30

## Implementation
**File:** `server/services/notifications/reminderScheduler.ts`

## What Was Added
After each SMS send attempt in `runReminderBatch()`, a `notification_log` row is inserted:

```
profile_id        = appointment's user_id
appointment_id    = appt.id
recipient_phone   = profile.phone
channel           = 'sms'
notification_type = 'appointment_reminder_24h' | 'appointment_reminder_same_day'
status            = 'sent' | 'failed' | 'skipped'
provider          = 'twilio'
provider_message_id = Twilio message SID (on success)
error_message     = error text (on failure)
```

## Notification Type Mapping
- `notificationType === 'reminder_24h'`  → `appointment_reminder_24h`
- `notificationType === 'reminder_same_day'` → `appointment_reminder_same_day`

These are SMS-specific types distinct from the email `reminder_24h`/`reminder_same_day` types to avoid confusion in analytics queries.

## All Scenarios Logged
- SMS sent successfully → status='sent', provider_message_id=Twilio SID
- SMS failed (Twilio error) → status='failed', error_message=err.message
- SMS not sent (Twilio unconfigured or no phone) → not logged (that path is not reached in the code)

## New DB Constraint Types
`appointment_reminder_24h` and `appointment_reminder_same_day` added to `notification_log_notification_type_check` in migration `2026-05-30_notification_types_communication_sprint.sql`.
