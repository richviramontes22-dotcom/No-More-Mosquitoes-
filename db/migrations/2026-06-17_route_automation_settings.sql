-- ============================================================
-- Routing Automation Policies — settings table
--
-- Singleton-style config table (one active row) read by
-- server/services/routing/routeAutomationPolicy.ts. Controls whether
-- generated routes require manual admin publish, auto-publish after a
-- review window, or auto-publish immediately once safe.
--
-- Disabled by default (enabled = false, mode = 'manual_only') — existing
-- manual publish behavior is completely unaffected until an admin opts in
-- via the Route Planning settings panel.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.route_automation_settings (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mode                      TEXT        NOT NULL DEFAULT 'manual_only'
                                         CHECK (mode IN ('manual_only', 'review_window', 'fully_automatic')),
  review_window_minutes     INTEGER     NOT NULL DEFAULT 60 CHECK (review_window_minutes > 0),
  auto_publish_cutoff_time  TIME,        -- optional: don't auto-publish before this time of day
  require_smart_optimize    BOOLEAN     NOT NULL DEFAULT TRUE,
  block_low_confidence      BOOLEAN     NOT NULL DEFAULT TRUE,
  block_mock_geo            BOOLEAN     NOT NULL DEFAULT TRUE,
  block_drive_cap_exceeded  BOOLEAN     NOT NULL DEFAULT TRUE,
  enabled                   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed exactly one default (safe, disabled) row if the table is empty.
INSERT INTO public.route_automation_settings (mode, enabled)
SELECT 'manual_only', FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.route_automation_settings);

ALTER TABLE public.route_automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS route_automation_settings_admin_only ON public.route_automation_settings;
CREATE POLICY route_automation_settings_admin_only ON public.route_automation_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
