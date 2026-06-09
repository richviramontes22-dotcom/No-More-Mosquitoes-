-- ─── Phase 2: Notification Infrastructure ────────────────────────────────────
-- Creates notification_log table for tracking all outbound notifications.
-- Safe to re-run: uses IF NOT EXISTS / DO $$ guards throughout.

CREATE TABLE IF NOT EXISTS public.notification_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id      UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  profile_id          UUID        REFERENCES public.profiles(id)     ON DELETE SET NULL,
  recipient_email     TEXT,
  recipient_phone     TEXT,
  channel             TEXT        NOT NULL CHECK (channel IN ('email', 'sms', 'push')),
  notification_type   TEXT        NOT NULL CHECK (notification_type IN (
                                    'appointment_confirmation',
                                    'reminder_24h',
                                    'reminder_same_day',
                                    'appointment_canceled',
                                    'appointment_rescheduled',
                                    'technician_enroute'
                                  )),
  subject             TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider            TEXT,
  provider_message_id TEXT,
  payload             JSONB,
  error_message       TEXT,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS notification_log_appointment_id_idx
  ON public.notification_log (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_log_profile_id_idx
  ON public.notification_log (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_log_status_idx
  ON public.notification_log (status);

CREATE INDEX IF NOT EXISTS notification_log_type_idx
  ON public.notification_log (notification_type);

CREATE INDEX IF NOT EXISTS notification_log_created_at_idx
  ON public.notification_log (created_at DESC);

-- Duplicate-prevention index: one 'sent' notification per (appointment, type)
CREATE UNIQUE INDEX IF NOT EXISTS notification_log_dedup_idx
  ON public.notification_log (appointment_id, notification_type)
  WHERE status = 'sent' AND appointment_id IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='notification_log' AND policyname='Admins full access on notification_log'
  ) THEN
    CREATE POLICY "Admins full access on notification_log"
      ON public.notification_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'notification_log'
-- ORDER BY ordinal_position;
-- Expected: 14 columns.
