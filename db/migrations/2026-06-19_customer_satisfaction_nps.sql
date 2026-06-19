-- ============================================================
-- Customer Satisfaction / NPS Foundation
--
-- One row per completed appointment (UNIQUE on appointment_id enforces
-- "one survey per appointment" at the DB level, not just app logic).
-- satisfaction_type is ALWAYS server-computed from rating via trigger —
-- never trusted from client input, so a caller can't submit a rating of 2
-- with satisfaction_type='promoter'.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_satisfaction_surveys (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id     UUID        NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  profile_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating             SMALLINT    NOT NULL CHECK (rating BETWEEN 0 AND 10),
  satisfaction_type  TEXT        NOT NULL CHECK (satisfaction_type IN ('promoter', 'passive', 'detractor')),
  comment            TEXT,
  issue_category     TEXT,
  followup_required  BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at        TIMESTAMPTZ,
  resolved_by        UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ticket_id          UUID        REFERENCES public.tickets(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS css_profile_id_idx ON public.customer_satisfaction_surveys (profile_id);
CREATE INDEX IF NOT EXISTS css_satisfaction_type_idx ON public.customer_satisfaction_surveys (satisfaction_type);
CREATE INDEX IF NOT EXISTS css_followup_pending_idx ON public.customer_satisfaction_surveys (followup_required, resolved_at) WHERE followup_required = TRUE AND resolved_at IS NULL;

-- Server-side classification — 9-10 promoter, 7-8 passive, 0-6 detractor.
-- Fires on every INSERT/UPDATE so satisfaction_type can never drift from
-- rating, regardless of what a caller sends.
CREATE OR REPLACE FUNCTION public.classify_satisfaction_survey()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rating >= 9 THEN
    NEW.satisfaction_type := 'promoter';
  ELSIF NEW.rating >= 7 THEN
    NEW.satisfaction_type := 'passive';
  ELSE
    NEW.satisfaction_type := 'detractor';
  END IF;

  -- Only auto-set followup_required on first insert of a detractor —
  -- never force it back on during a later UPDATE (e.g. while staff are in
  -- the middle of resolving it).
  IF TG_OP = 'INSERT' AND NEW.satisfaction_type = 'detractor' THEN
    NEW.followup_required := TRUE;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_satisfaction_surveys_classify ON public.customer_satisfaction_surveys;
CREATE TRIGGER customer_satisfaction_surveys_classify
  BEFORE INSERT OR UPDATE ON public.customer_satisfaction_surveys
  FOR EACH ROW EXECUTE FUNCTION public.classify_satisfaction_survey();

ALTER TABLE public.customer_satisfaction_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS css_customer_select ON public.customer_satisfaction_surveys;
CREATE POLICY css_customer_select ON public.customer_satisfaction_surveys
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS css_customer_insert ON public.customer_satisfaction_surveys;
CREATE POLICY css_customer_insert ON public.customer_satisfaction_surveys
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.appointments WHERE appointments.id = appointment_id AND appointments.user_id = auth.uid())
  );

-- Deliberately no customer UPDATE policy — once submitted, a survey can
-- only be resolved/edited by staff, never the customer.

DROP POLICY IF EXISTS css_staff_all ON public.customer_satisfaction_surveys;
CREATE POLICY css_staff_all ON public.customer_satisfaction_surveys
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'customer_service'))
  );
