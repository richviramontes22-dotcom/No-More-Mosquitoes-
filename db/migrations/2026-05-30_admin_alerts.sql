-- ============================================================
-- Admin Alerts Table
-- Stores internal owner/admin alert events for the alert bell
-- and notification history in the admin dashboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       TEXT        NOT NULL,
  severity         TEXT        NOT NULL DEFAULT 'info'
                              CHECK (severity IN ('info', 'warning', 'critical')),
  title            TEXT        NOT NULL,
  body             TEXT,
  entity_type      TEXT,   -- e.g. 'appointment', 'subscription', 'user', 'webhook'
  entity_id        TEXT,   -- UUID or Stripe ID of the related entity
  metadata         JSONB,  -- arbitrary event details (amount, email, etc.)
  acknowledged_at  TIMESTAMPTZ,
  acknowledged_by  UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  notified_email   BOOLEAN NOT NULL DEFAULT FALSE,
  notified_sms     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast look-ups by severity and resolution state (alert bell query)
CREATE INDEX IF NOT EXISTS admin_alerts_severity_idx     ON public.admin_alerts (severity);
CREATE INDEX IF NOT EXISTS admin_alerts_resolved_at_idx  ON public.admin_alerts (resolved_at);
CREATE INDEX IF NOT EXISTS admin_alerts_created_at_idx   ON public.admin_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_alerts_event_type_idx   ON public.admin_alerts (event_type);

-- Deduplication: prevent identical in-flight alerts
CREATE INDEX IF NOT EXISTS admin_alerts_dedup_idx
  ON public.admin_alerts (event_type, entity_type, entity_id)
  WHERE resolved_at IS NULL;

-- RLS: only admins may read/write
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_alerts_admin_only ON public.admin_alerts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
