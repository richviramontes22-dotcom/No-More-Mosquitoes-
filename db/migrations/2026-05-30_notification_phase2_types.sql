-- ─── Notification Phase 2: Expand notification_log CHECK constraint ─────────────
-- Adds new notification types introduced during Notification Phase 2 (Gap Closure Sprint).
-- Uses the same DROP+RECREATE pattern as prior migration files.
--
-- New types added:
--   employee_assignment_created    — Employee notified of new assignment
--   employee_assignment_cancelled  — Employee notified that their assignment was cancelled
--   employee_assignment_updated    — Employee notified of assignment update
--   email_opted_out                — Customer used one-click unsubscribe link

ALTER TABLE public.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_notification_type_check;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_notification_type_check
  CHECK (notification_type IN (
    -- Original Phase 2 types
    'appointment_confirmation',
    'reminder_24h',
    'reminder_same_day',
    'appointment_canceled',
    'appointment_rescheduled',
    'technician_enroute',
    -- Added in 2026-05-29 migration
    'service_completed',
    'appointment_canceled_employee',
    'appointment_canceled_customer',
    'scheduling_failure',
    'payment_failed',
    'subscription_canceled',
    'logged',
    -- Added in Communication Sprint (2026-05-30)
    'subscription_activated',
    'subscription_renewed',
    'annual_expiring_30d',
    'annual_expiring_7d',
    'annual_expired',
    'appointment_reminder_24h',
    'appointment_reminder_same_day',
    'technician_en_route',
    'lead_acknowledgement',
    'sms_opt_out',
    'sms_opt_in',
    -- Added in Notification Phase 2 Gap Closure (2026-05-30)
    'employee_assignment_created',
    'employee_assignment_cancelled',
    'employee_assignment_updated',
    'email_opted_out'
  ));

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'notification_log_notification_type_check';
