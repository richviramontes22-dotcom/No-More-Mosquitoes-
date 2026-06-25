# Employee Notification System Report
**Date:** 2026-05-30
**Phase:** 7 — Employee Notification System

## Summary
Centralized employee notification service created with branded templates, preference checks, notification logging, and full wiring into admin routes.

## Files Created

| File | Purpose |
|------|---------|
| `server/services/notifications/employeeNotificationService.ts` | Core employee notification service |

## Files Modified

| File | Change |
|------|---------|
| `server/services/notifications/emailTemplates.ts` | Added `buildEmployeeAssignmentEmail()` |
| `server/services/notifications/smsTemplates.ts` | Added `buildEmployeeAssignmentSms()` |
| `server/routes/adminAppointments.ts` | Wired `notifyEmployeeAssigned()` + `notifyEmployeeAssignmentCancelled()` |
| `server/services/notifications/notificationLogger.ts` | Added 3 new NotificationType values |

## Employee Notification Service

### Public API
```typescript
export function notifyEmployeeAssigned(assignmentId: string): void
export function notifyEmployeeAssignmentChanged(assignmentId: string, changeType: string): void
export function notifyEmployeeAssignmentCancelled(assignmentId: string): void
```

All functions are **fire-and-forget** (void, wrapped in catch).

### Notification Flow
1. Fetch assignment + employee + appointment + property data
2. Check `employee.status === 'active'` — skip if not active
3. Check `emailAssignmentAlerts !== false` before email
4. Check `smsAssignmentAlerts !== false && smsOptedOut !== true` before SMS
5. Build branded email using `buildEmployeeAssignmentEmail()`
6. Build concise SMS using `buildEmployeeAssignmentSms()`
7. Send via `getEmailProvider()` and `getSmsProvider()`
8. Log each send/skip/fail to `notification_log`

### Templates

#### Email: `buildEmployeeAssignmentEmail()`
- Internal branded email (separate from customer templates)
- Green header for "New Assignment", red for "Cancelled"
- Shows: date, window, address, notes, "View My Schedule" CTA
- No STOP footer (internal staff email)

#### SMS: `buildEmployeeAssignmentSms()`
- `[NMM Ops] New assignment: {date}, {window} at {address}. Check portal: {url}`
- No opt-out footer (internal — TCPA applies to customer-facing marketing)

## Wiring in adminAppointments.ts

**POST /api/admin/assignments:**
- Replaced raw-HTML inline email with `notifyEmployeeAssigned(assignmentId)` per appointment
- Fetches assignment ID after upsert to pass to service
- Service fetches full context (appointment date, window, address) for rich notification

**PATCH /api/admin/appointments/:id/cancel:**
- Replaced `console.log` intent comment with `notifyEmployeeAssignmentCancelled(asgn.id)` per assignment

## Notification Log Types
- `employee_assignment_created`
- `employee_assignment_cancelled`
- `employee_assignment_updated`

All three added to `NotificationType` union in `notificationLogger.ts`.
See Phase 10 for DB migration.
