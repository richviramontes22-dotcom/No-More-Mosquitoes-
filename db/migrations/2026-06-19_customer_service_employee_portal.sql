-- ============================================================
-- Customer Service / Sales — move into the employee portal
--
-- Follow-up to 2026-06-19_ticketing_hardening.sql and
-- 2026-06-19_customer_satisfaction_nps.sql. Those migrations already grant
-- customer_service write access to tickets/ticket_messages/
-- ticket_internal_notes/customer_satisfaction_surveys. This migration
-- closes the one remaining gap: appointment_reschedule_requests still only
-- allowed ('admin', 'employee'), not 'customer_service'.
-- ============================================================

DROP POLICY IF EXISTS reschedule_requests_admin_all ON public.appointment_reschedule_requests;
CREATE POLICY reschedule_requests_admin_all ON public.appointment_reschedule_requests
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'employee', 'customer_service'))
  );
