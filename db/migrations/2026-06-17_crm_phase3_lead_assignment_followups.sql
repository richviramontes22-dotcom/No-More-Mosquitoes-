-- ============================================================
-- CRM Phase 3 Foundation: lead assignment + follow-up tracking
--
-- 1. ALTER leads — add assigned_to (denormalized "current owner" cache,
--    kept in sync by the API layer whenever a new lead_assignments row is
--    inserted — avoids a join on every Lead Inbox list render)
-- 2. CREATE lead_assignments — full assignment history (who, by whom, when)
-- 3. CREATE lead_followups — due-dated tasks per lead
--
-- No SMS/call tracking, no automated reminders — due dates are surfaced in
-- the admin UI only, per this sprint's constraints.
-- ============================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON public.leads (assigned_to);

CREATE TABLE IF NOT EXISTS public.lead_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_assignments_lead_id_idx ON public.lead_assignments (lead_id, created_at DESC);

ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_assignments_admin_only ON public.lead_assignments;
CREATE POLICY lead_assignments_admin_only ON public.lead_assignments
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE TABLE IF NOT EXISTS public.lead_followups (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at        TIMESTAMPTZ NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  notes         TEXT,
  completed_at  TIMESTAMPTZ,
  created_by    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_followups_lead_id_idx ON public.lead_followups (lead_id);
CREATE INDEX IF NOT EXISTS lead_followups_due_at_idx  ON public.lead_followups (due_at) WHERE status = 'pending';

ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_followups_admin_only ON public.lead_followups;
CREATE POLICY lead_followups_admin_only ON public.lead_followups
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Reuse the shared updated_at trigger (defined in 2026-06-15_create_leads_tables.sql).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lead_followups_updated_at ON public.lead_followups;
CREATE TRIGGER lead_followups_updated_at
  BEFORE UPDATE ON public.lead_followups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
