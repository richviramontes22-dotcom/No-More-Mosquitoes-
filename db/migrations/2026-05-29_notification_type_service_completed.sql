-- ─── Add service_completed to notification_log CHECK constraint ────────────────
-- The completion notification in employeeAssignments.ts previously used
-- notification_type: "appointment_confirmation" for the service completion log.
-- This conflicts with the deduplication unique index:
--   UNIQUE (appointment_id, notification_type) WHERE status = 'sent'
-- The second insert (for completion) would silently fail because the first
-- (booking confirmation) already occupies the unique slot.
--
-- Fix: change notification_type to "service_completed" in code, and add it to
-- the CHECK constraint here.
--
-- Also adds additional notification types used in current code that were not
-- in the original Phase 2 constraint.

ALTER TABLE public.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_notification_type_check;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_notification_type_check
  CHECK (notification_type IN (
    'appointment_confirmation',
    'reminder_24h',
    'reminder_same_day',
    'appointment_canceled',
    'appointment_rescheduled',
    'technician_enroute',
    'service_completed',
    'appointment_canceled_employee',
    'appointment_canceled_customer',
    'scheduling_failure',
    'payment_failed',
    'subscription_canceled',
    'logged'
  ));

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'notification_log' AND constraint_type = 'CHECK';
