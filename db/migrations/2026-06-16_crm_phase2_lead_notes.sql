-- CRM Phase 2: Lead Notes + Status Management + Service Area Intelligence
-- Applied: 2026-06-16
--
-- 1. ALTER leads — add lost_reason, service area columns, out_of_area_reason
-- 2. CREATE lead_notes table (staff-written notes, admin-only RLS)
-- 3. CREATE service_area_demand_events table (demand tracking for uncovered ZIPs)

-- ─── 1. Extend leads ───────────────────────────────────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lost_reason         TEXT,
  ADD COLUMN IF NOT EXISTS service_state       TEXT,
  ADD COLUMN IF NOT EXISTS service_county      TEXT,
  ADD COLUMN IF NOT EXISTS service_zip         TEXT,
  ADD COLUMN IF NOT EXISTS service_area_status TEXT CHECK (service_area_status IN ('covered', 'not_covered', 'unknown')),
  ADD COLUMN IF NOT EXISTS service_area_id     UUID REFERENCES public.service_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS out_of_area_reason  TEXT;

-- ─── 2. lead_notes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lead_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_notes_lead_id_idx    ON public.lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS lead_notes_created_at_idx ON public.lead_notes(created_at DESC);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_notes' AND policyname = 'lead_notes_admin_only'
  ) THEN
    CREATE POLICY "lead_notes_admin_only"
      ON public.lead_notes FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      ));
  END IF;
END $$;

CREATE TRIGGER set_lead_notes_updated_at
  BEFORE UPDATE ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. service_area_demand_events ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_area_demand_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  zip        TEXT        NOT NULL,
  event_type TEXT        NOT NULL CHECK (event_type IN ('out_of_area_quote', 'waitlist_signup')),
  lead_id    UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  email      TEXT,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sade_zip_idx        ON public.service_area_demand_events(zip);
CREATE INDEX IF NOT EXISTS sade_created_at_idx ON public.service_area_demand_events(created_at DESC);

ALTER TABLE public.service_area_demand_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'service_area_demand_events' AND policyname = 'sade_admin_only'
  ) THEN
    CREATE POLICY "sade_admin_only"
      ON public.service_area_demand_events FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      ));
  END IF;
END $$;
