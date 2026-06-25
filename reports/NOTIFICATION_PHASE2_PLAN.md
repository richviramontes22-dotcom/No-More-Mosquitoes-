# Notification Phase 2 Plan
**Date:** 2026-05-30

## Source Analysis Summary

### What's Already Working
- Email provider abstraction (Resend via `providers/index.ts`) — fully functional
- SMS provider abstraction (Twilio fetch-based) — functional but not used everywhere
- `reminderScheduler.ts` checks `smsReminders !== false` before sending SMS — PARTIAL (no smsOptedOut check, no emailReminders check, no skipped logging for opted-out users)
- `sendEnRouteSMS.ts` uses twilioClient directly (not provider abstraction) — uses Twilio SDK, not getSmsProvider()
- Admin alert backend: `adminAlerts.ts`, `adminNotificationService.ts` — complete
- `notification_log` types cover existing sends but missing employee types

### Identified Gaps

#### Customer Notification Gaps
1. `reminderScheduler.ts` does not check `smsOptedOut === true` — users who STOP-replied still get SMS
2. `reminderScheduler.ts` does not check `emailReminders !== false` before sending reminder emails
3. SMS sends that are skipped due to opt-out are not logged to `notification_log`
4. No one-click email unsubscribe (`?unsub=<profileId>` token + server route)
5. `sendEnRouteSMS.ts` uses twilioClient directly instead of getSmsProvider()

#### Admin Alert UI Gaps
6. No alert bell in SiteHeader — polling `/api/admin/alerts/counts`
7. No `/admin/alerts` page
8. No `useAdminAlerts` hook

#### Admin Scheduling Alert Gaps
9. No alert on appointment cancellation (admin or customer-initiated)
10. No alert on appointment reschedule
11. No alert on appointment created without assignment

#### Admin Field Ops Alert Gaps
12. No alert when assignment status → `no_show`
13. No alert when assignment status → `skipped`

#### Admin System Health Alert Gaps
14. No alert on Stripe webhook signature failure

#### Employee Notification Gaps
15. No centralized employee notification service
16. Assignment emails sent with raw HTML (no template, no logging, no pref checks)
17. No employee-specific notification types in `notification_log`

#### Migration Gaps
18. `notification_log` CHECK constraint missing employee types

## Phase Execution Plan

### Phase 1: Build Verification
- Run `npx tsc --noEmit` to capture baseline
- Document errors

### Phase 2: Customer Notification Gap Fixes
- 2a: Add `smsOptedOut` check in `reminderScheduler.ts`
- 2b: Verify SMS provider usage in `sendEnRouteSMS.ts` (keep twilioClient — getSmsProvider() lacks SID return for logging)
- 2c: Log skipped SMS when opted-out
- 2d: Add `/api/unsubscribe?unsub=<profileId>` route + update email footer
- 2e: Add `emailReminders !== false` check in reminder sends

### Phase 3: Admin Alert UI
- 3a: Alert bell in SiteHeader (poll counts, dropdown with recent alerts)
- 3b: Admin Alerts page at `/admin/alerts`
- 3c: `useAdminAlerts` hook

### Phase 4: Admin Scheduling Alerts
- Hook cancellation in `adminAppointments.ts` (PATCH cancel)
- Hook reschedule in `customerAppointments.ts` (POST reschedule)
- Hook "no assignment" check in `adminAppointments.ts` (POST assignments)

### Phase 5: Admin Field Ops Alerts
- Hook `no_show` in `employeeAssignments.ts` status update
- Hook `skipped` in `employeeAssignments.ts` status update
- Note `field_ops.service_completed` already wired — do not duplicate

### Phase 6: Admin System Health Alerts
- Hook signature failure in `webhooksStripe.ts` (try/catch around constructEvent)
- Use console.error fallback for provider failures (simpler, avoids recursion)

### Phase 7: Employee Notification System
- Create `server/services/notifications/employeeNotificationService.ts`
- Add `buildEmployeeAssignmentEmail()` to emailTemplates.ts
- Add `buildEmployeeAssignmentSms()` to smsTemplates.ts
- Wire into admin assignments route

### Phase 8: Employee Notification Preferences
- Document JSONB schema for employee prefs in profiles table
- Add pref checks in employeeNotificationService.ts

### Phase 9: Employee Dashboard Visibility
- Review AssignmentDetail.tsx — add "Recent Updates" panel (status timeline)

### Phase 10: Migrations
- Create `2026-05-30_notification_phase2_types.sql`

### Phase 11: Final TypeScript check + fix all errors

## Key Constraints
- Fire-and-forget: never await in HTTP handlers
- NullProvider: never crash on missing creds
- Employee: check status='active' before notifying
- SMS: check smsOptedOut !== true AND smsReminders !== false
- TypeScript MUST pass before finalization
