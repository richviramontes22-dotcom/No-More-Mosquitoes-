-- ============================================================
-- Customer Experience Phase 1
--
-- 1. appointment_reschedule_requests — a customer-initiated REQUEST that an
--    admin must approve/deny. This is ADDITIVE: the existing instant
--    self-service reschedule (POST /api/appointments/:id/reschedule, no
--    approval needed) is untouched and remains available. This is a second,
--    slower path for cases where a customer wants to ask for a date that
--    isn't open for instant self-booking.
-- 2. customer_notification_settings — singleton, DB-backed admin toggles for
--    reminder/review emails. The existing 24h/same-day reminder system is
--    gated by env vars (ENABLE_REMINDER_EMAILS) — this table adds an
--    *additional* admin-facing on/off switch read at send time, without
--    removing the env var gate (both must allow sending).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointment_reschedule_requests (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id          UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_scheduled_date  DATE,
  preferred_date          DATE        NOT NULL,
  preferred_window_label  TEXT        NOT NULL,
  reason                  TEXT,
  status                  TEXT        NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending', 'approved', 'denied')),
  admin_notes             TEXT,
  reviewed_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_reschedule_requests_status_idx
  ON public.appointment_reschedule_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS appointment_reschedule_requests_appointment_idx
  ON public.appointment_reschedule_requests (appointment_id);

ALTER TABLE public.appointment_reschedule_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reschedule_requests_customer_select ON public.appointment_reschedule_requests;
CREATE POLICY reschedule_requests_customer_select ON public.appointment_reschedule_requests
  FOR SELECT
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS reschedule_requests_customer_insert ON public.appointment_reschedule_requests;
CREATE POLICY reschedule_requests_customer_insert ON public.appointment_reschedule_requests
  FOR INSERT
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS reschedule_requests_admin_all ON public.appointment_reschedule_requests;
CREATE POLICY reschedule_requests_admin_all ON public.appointment_reschedule_requests
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'employee'))
  );

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointment_reschedule_requests_updated_at ON public.appointment_reschedule_requests;
CREATE TRIGGER appointment_reschedule_requests_updated_at
  BEFORE UPDATE ON public.appointment_reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Notification settings (singleton) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_notification_settings (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_24h_enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  reminder_2h_enabled         BOOLEAN     NOT NULL DEFAULT FALSE,
  review_request_enabled      BOOLEAN     NOT NULL DEFAULT FALSE,
  review_link_url             TEXT,
  updated_by                  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- reminder_24h_enabled defaults TRUE because the 24h reminder already ships
-- live today (gated only by the ENABLE_REMINDER_EMAILS env var) — this just
-- adds a second, admin-facing switch on top without changing today's
-- default behavior. reminder_2h and review_request are NEW sends, so they
-- default FALSE (opt-in) per the "do not bypass admin safety defaults" rule.
INSERT INTO public.customer_notification_settings (reminder_24h_enabled, reminder_2h_enabled, review_request_enabled)
SELECT TRUE, FALSE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.customer_notification_settings);

ALTER TABLE public.customer_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_notification_settings_admin_only ON public.customer_notification_settings;
CREATE POLICY customer_notification_settings_admin_only ON public.customer_notification_settings
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP TRIGGER IF EXISTS customer_notification_settings_updated_at ON public.customer_notification_settings;
CREATE TRIGGER customer_notification_settings_updated_at
  BEFORE UPDATE ON public.customer_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
