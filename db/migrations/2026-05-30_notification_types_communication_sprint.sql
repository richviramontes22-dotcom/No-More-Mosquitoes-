-- ─── Communication Sprint: Expand notification_log CHECK constraint ────────────
-- Adds all new notification types introduced during the Communication Readiness Sprint.
-- Uses the same DROP+RECREATE pattern as 2026-05-29_notification_type_service_completed.sql
--
-- New types added:
--   payment_failed              — Stripe invoice.payment_failed customer email
--   subscription_activated      — New subscription welcome email
--   subscription_renewed        — Subscription renewal (billing_reason = subscription_cycle)
--   subscription_canceled       — customer.subscription.deleted email (already existed, kept for clarity)
--   annual_expiring_30d         — Annual plan 30-day expiry warning
--   annual_expiring_7d          — Annual plan 7-day expiry warning
--   annual_expired              — Annual plan expiration notification
--   appointment_reminder_24h    — SMS-specific 24h reminder (distinct from email reminder_24h)
--   appointment_reminder_same_day — SMS-specific same-day reminder
--   technician_en_route         — En-route fallback email when customer has no phone
--   lead_acknowledgement        — "We received your request" email on schedule_request save
--   sms_opt_out                 — Customer replied STOP
--   sms_opt_in                  — Customer replied START

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
    'sms_opt_in'
  ));

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'notification_log_notification_type_check';
