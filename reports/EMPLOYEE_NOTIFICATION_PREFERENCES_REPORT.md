# Employee Notification Preferences Report
**Date:** 2026-05-30
**Phase:** 8 — Employee Notification Preferences

## Summary
Employee notification preferences use the existing `notification_preferences` JSONB column on the `profiles` table (via `employees.user_id`). No migration needed.

## Preference Storage

The `employees` table has a `notification_preferences` JSONB column (based on audit of `server/routes/adminEmployees.ts` and `server/routes/employeeAssignments.ts` — the service reads `employee.notification_preferences`).

The `employeeNotificationService.ts` reads this column directly:
```typescript
const { data: employee } = await db
  .from("employees")
  .select("id, user_id, name, email, phone, status, notification_preferences")
  .eq("id", assignment.employee_id)
  .maybeSingle();
```

## Expected JSONB Shape
```jsonb
{
  "emailAssignmentAlerts": true,   // default true — new/updated/cancelled assignment emails
  "smsAssignmentAlerts": true,     // default true — assignment SMS
  "appointmentReminders": true,    // reserved — future employee day-of reminders
  "smsOptedOut": false             // set true if employee replies STOP
}
```

When `notification_preferences` is null or missing a key, the service defaults to **send** (opt-out model, consistent with customer behavior).

## Preference Checks in employeeNotificationService.ts
```typescript
function shouldSendEmail(prefs: Record<string, unknown> | null): boolean {
  if (!prefs) return true; // default: send
  return prefs.emailAssignmentAlerts !== false;
}

function shouldSendSms(prefs: Record<string, unknown> | null): boolean {
  if (!prefs) return true;
  return prefs.smsAssignmentAlerts !== false && prefs.smsOptedOut !== true;
}
```

## No Migration Needed
The `notification_preferences` JSONB column already exists on the `employees` table. New keys (emailAssignmentAlerts, smsAssignmentAlerts) are simply added to the JSONB payload when employees update their preferences. No ALTER TABLE required.

## Admin UI Gap (Future Work)
There is currently no admin UI to set per-employee notification preferences. An admin could edit preferences via the Supabase Dashboard or a future "Employee Edit" modal. The service correctly reads whatever is stored.

## Default Behavior
All current employees have `notification_preferences = null` (assumed). The service defaults to sending both email and SMS when preferences are null, which means:
- All active employees with email addresses receive assignment notifications
- Employees with phone numbers receive SMS (when Twilio is configured)
