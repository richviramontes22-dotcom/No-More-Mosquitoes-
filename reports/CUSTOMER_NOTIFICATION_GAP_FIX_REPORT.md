# Customer Notification Gap Fix Report
**Date:** 2026-05-30
**Phase:** 2 — Customer Notification Gap Fixes

## Summary
All 5 customer notification gaps have been addressed.

## 2a. SMS Opt-Out Enforcement in Reminder Scheduler

**File:** `server/services/notifications/reminderScheduler.ts`

**Changes:**
- Added `smsOptedOut` field to profileMap (reads `notification_preferences.smsOptedOut`)
- Added `emailReminders` field to profileMap (reads `notification_preferences.emailReminders`)
- SMS gate changed from `profile.smsReminders && profile.phone` to `profile.smsReminders && !profile.smsOptedOut && profile.phone`
- Before the email send, if `emailReminders === false`, the appointment is skipped with a logged `skipped` status

**Logic:**
```typescript
// smsOptedOut check
if (profile.smsReminders && !profile.smsOptedOut && profile.phone && isSmsConfigured()) {
  // send SMS
}
```

## 2b. SMS Provider Unification

**Files:** `sendEnRouteSMS.ts`, `sendAppointmentReminder.ts`

- `sendAppointmentReminder.ts` uses Resend client directly (email only — SMS is in reminderScheduler.ts) — no change needed
- `sendEnRouteSMS.ts` uses twilioClient directly (original pattern) — kept as-is because it reads the returned `message.sid` for logging which the provider abstraction doesn't expose
- `reminderScheduler.ts` also uses twilioClient directly for the same reason (SID logging)
- The `getSmsProvider()` abstraction is used in `adminNotificationService.ts` for admin SMS where SID is not needed

**Documentation:** SMS SID logging requires direct Twilio client access. The getSmsProvider() abstraction is NullProvider-safe but does not return message SIDs. Both approaches are valid; the direct client is acceptable when SID is required for notification_log.

## 2c. Skipped SMS Logging

**File:** `server/services/notifications/reminderScheduler.ts`

**Changes:** Added explicit `logNotification` call with `status: "skipped"` when SMS is not sent due to:
- `smsOptedOut === true` (STOP keyword received)
- `smsReminders === false` (customer preference toggle)

**Also:** Added email reminder skipped log when `emailReminders === false`.

## 2d. One-Click Unsubscribe Token

**New file:** `server/routes/unsubscribe.ts`
- `GET /api/unsubscribe?unsub=<profileId>` — sets `notification_preferences.emailOptedOut = true`
- Responds with a branded HTML confirmation page
- Logs the action to `notification_log` with type `email_opted_out`
- No authentication required (profileId is the token, sufficient for unsubscribe)

**Email template update:** `server/services/notifications/emailTemplates.ts`
- `layout()` now accepts optional `profileId` parameter
- Footer includes: `<a href="{appUrl}/api/unsubscribe?unsub={profileId}">Unsubscribe from emails</a>`
- Falls back to `/dashboard/profile` when profileId is not provided

**Route registration:** `server/index.ts` — `app.use("/api", unsubscribeRouter)`

## 2e. Email Preference Enforcement

**File:** `server/services/notifications/reminderScheduler.ts`

**Changes:** Before calling `sendAppointmentReminder()`, check `profile.emailReminders !== false`. If false, skip the email and log a `skipped` entry to `notification_log`.

## NotificationType Updates

**File:** `server/services/notifications/notificationLogger.ts`

New types added to the `NotificationType` union:
- `email_opted_out`
- `employee_assignment_created`
- `employee_assignment_cancelled`
- `employee_assignment_updated`

## Status

| Gap | Status |
|-----|--------|
| 2a: smsOptedOut enforcement | FIXED |
| 2b: SMS provider unification | DOCUMENTED (direct client needed for SID logging) |
| 2c: Skipped SMS logging | FIXED |
| 2d: Unsubscribe token | FIXED |
| 2e: Email preference enforcement | FIXED |
