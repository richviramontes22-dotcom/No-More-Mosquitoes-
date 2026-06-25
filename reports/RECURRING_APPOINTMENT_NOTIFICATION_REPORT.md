# Recurring Appointment Notification Report

**Date:** 2026-05-30

## Existing System (Pre-Sprint)
The `reminderScheduler.ts` and `netlify/functions/send-reminders.ts` already handled:
- 24-hour reminder emails via `sendAppointmentReminder()`
- Same-day reminder emails via `sendAppointmentReminder()`
- SMS reminders via Twilio (existing twilioClient.ts — uses Twilio npm package)

## Changes Made in Sprint

### SMS Logging Added
SMS sends in `runReminderBatch()` now log to `notification_log` with:
- `channel = 'sms'`
- `notification_type = 'appointment_reminder_24h'` or `'appointment_reminder_same_day'`
- `status = 'sent'|'failed'`
- `provider_message_id = Twilio SID`

### OPT-OUT Footer Added
`buildReminderSms()` now appends `\nReply STOP to opt out | HELP for help`

## No Changes To
- Reminder scheduling logic (still time-window based)
- Email reminder flow (still uses `sendAppointmentReminder` / Resend)
- Duplicate prevention (still uses `isDuplicateNotification`)
- Customer opt-in logic (still reads `notification_preferences.smsReminders`)

## Note on Provider Abstraction
The existing `reminderScheduler.ts` uses `getTwilioClient()` directly (Twilio npm package), not the new `getSmsProvider()` (fetch-based). This is intentional — the reminderScheduler was written to use the Twilio npm package and was not migrated to avoid regression risk. New SMS sends in new routes should use `getSmsProvider()`.
