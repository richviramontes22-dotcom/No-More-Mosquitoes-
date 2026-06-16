-- ============================================================
-- CRM Phase 1: Leads + Lead Activities
-- Foundation tables for the admin Lead Inbox. Populated by
-- upsertLeadFromQuote(), upsertLeadFromManualReview(), and
-- upsertLeadFromScheduleRequest() in server/services/leads/leadService.ts.
-- See admin-crm-audit-reports/CRM_ARCHITECTURE_RECOMMENDATION.md (Section 1)
-- for the full design rationale.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source                 TEXT        NOT NULL, -- 'quote' | 'manual_review' | 'schedule_request'
  status                 TEXT        NOT NULL DEFAULT 'new', -- 'new' | 'manual_review' | 'scheduled'
  address_hash           TEXT,
  address                TEXT,
  zip                    TEXT,
  name                   TEXT,
  email                  TEXT,
  phone                  TEXT,
  acreage                NUMERIC,
  program                TEXT,
  cadence                TEXT,
  manual_review_reason   TEXT,
  profile_id             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  property_id            UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  subscription_id        UUID        REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  schedule_request_id    UUID        REFERENCES public.schedule_requests(id) ON DELETE SET NULL,
  admin_alert_id         UUID        REFERENCES public.admin_alerts(id) ON DELETE SET NULL,
  converted_customer_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_seen_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_address_hash_idx ON public.leads (address_hash);
CREATE INDEX IF NOT EXISTS leads_email_idx        ON public.leads (email);
CREATE INDEX IF NOT EXISTS leads_phone_idx        ON public.leads (phone);
CREATE INDEX IF NOT EXISTS leads_status_idx       ON public.leads (status);
CREATE INDEX IF NOT EXISTS leads_source_idx       ON public.leads (source);
CREATE INDEX IF NOT EXISTS leads_created_at_idx   ON public.leads (created_at DESC);

-- Keep updated_at current on every row change (reuses the shared trigger
-- function created in 2025-11-25_tickets_table.sql; CREATE OR REPLACE here
-- makes this migration runnable standalone too).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_admin_only ON public.leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- Lead Activities — append-only timeline per lead
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lead_activities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT        NOT NULL, -- 'created' | 'quote_requested' | 'manual_review' | 'schedule_request_received' | 'merged'
  actor         TEXT        NOT NULL DEFAULT 'system' CHECK (actor IN ('system', 'admin')),
  actor_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_activities_lead_id_idx       ON public.lead_activities (lead_id);
CREATE INDEX IF NOT EXISTS lead_activities_activity_type_idx ON public.lead_activities (activity_type);
CREATE INDEX IF NOT EXISTS lead_activities_created_at_idx    ON public.lead_activities (created_at DESC);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_activities_admin_only ON public.lead_activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
