# Notification Phase 2 — Migration Report
**Date:** 2026-05-30
**Phase:** 10 — Migrations

## Migration File Created

**`db/migrations/2026-05-30_notification_phase2_types.sql`**

### Pattern
Same DROP CONSTRAINT + ADD CONSTRAINT pattern as all prior notification_log migrations.

### New Types Added
| Type | When Logged |
|------|-------------|
| `employee_assignment_created` | Employee notified of new assignment |
| `employee_assignment_cancelled` | Employee notified assignment was cancelled |
| `employee_assignment_updated` | Employee notified of assignment update |
| `email_opted_out` | Customer used one-click email unsubscribe |

### Full Constraint (after this migration)
All prior types preserved + 4 new types = complete set consistent with `NotificationType` union in `notificationLogger.ts`.

## Pending Migrations (Run in Order)

The following migrations must be run in Supabase SQL Editor **in this order** before deploying Phase 2 code:

1. `db/migrations/2026-05-30_notification_types_communication_sprint.sql` ← run first (may already be run)
2. `db/migrations/2026-05-30_admin_alerts.sql` ← required for admin_alerts table
3. **`db/migrations/2026-05-30_notification_phase2_types.sql`** ← new this phase

If #1 and #2 were already run during the prior sprint, only #3 needs to be run.

## Risk
If code is deployed before the migration, any `employee_assignment_*` or `email_opted_out` log entries will fail the DB CHECK constraint and produce an error (logged to console, non-fatal due to try/catch in logNotification). The feature still works but logging is broken.

**Run the migration before deploying Phase 2 code.**
