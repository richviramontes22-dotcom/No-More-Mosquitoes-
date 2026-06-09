-- ─── Phase 1: Reliable Appointment Availability ──────────────────────────────
-- Adds business_hours, blackout_dates, and window fields to appointments.
-- Safe to re-run: uses IF NOT EXISTS / DO $$ guards throughout.

-- ─── 1. business_hours ────────────────────────────────────────────────────────
-- Defines operating windows per day of week, optionally scoped to a service area.
-- service_area_id = NULL means the row applies to ALL service areas (global default).
-- A service-area-specific row overrides the global row for that area.
--
-- The "windows" JSONB column holds an array of window objects, e.g.:
-- [
--   { "id": "morning",   "label": "Morning (8AM–12PM)",   "start": "08:00", "end": "12:00", "max_jobs_per_tech": 3 },
--   { "id": "afternoon", "label": "Afternoon (12PM–4PM)", "start": "12:00", "end": "16:00", "max_jobs_per_tech": 3 }
-- ]

CREATE TABLE IF NOT EXISTS public.business_hours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_id UUID REFERENCES public.service_areas(id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_operational  BOOLEAN NOT NULL DEFAULT true,
  windows         JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: one global row per day, one per (service_area, day)
CREATE UNIQUE INDEX IF NOT EXISTS business_hours_global_day_uq
  ON public.business_hours (day_of_week)
  WHERE service_area_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_hours_area_day_uq
  ON public.business_hours (service_area_id, day_of_week)
  WHERE service_area_id IS NOT NULL;

ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='business_hours' AND policyname='Admins full access on business_hours') THEN
    CREATE POLICY "Admins full access on business_hours"
      ON public.business_hours FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='business_hours' AND policyname='Anyone can read business_hours') THEN
    CREATE POLICY "Anyone can read business_hours"
      ON public.business_hours FOR SELECT USING (true);
  END IF;
END $$;


-- ─── 2. blackout_dates ────────────────────────────────────────────────────────
-- Blocks scheduling on specific dates.
-- scope = 'all'          → blocks all service areas
-- scope = 'service_area' → blocks only the referenced service area
-- scope = 'employee'     → reserved for future per-technician blocks

CREATE TABLE IF NOT EXISTS public.blackout_dates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  reason          TEXT,
  scope           TEXT NOT NULL DEFAULT 'all'
                    CHECK (scope IN ('all', 'service_area', 'employee')),
  service_area_id UUID REFERENCES public.service_areas(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES public.employees(id)     ON DELETE CASCADE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blackout_dates_date_idx
  ON public.blackout_dates (date);

CREATE INDEX IF NOT EXISTS blackout_dates_area_date_idx
  ON public.blackout_dates (service_area_id, date)
  WHERE service_area_id IS NOT NULL;

ALTER TABLE public.blackout_dates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blackout_dates' AND policyname='Admins full access on blackout_dates') THEN
    CREATE POLICY "Admins full access on blackout_dates"
      ON public.blackout_dates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='blackout_dates' AND policyname='Anyone can read blackout_dates') THEN
    CREATE POLICY "Anyone can read blackout_dates"
      ON public.blackout_dates FOR SELECT USING (true);
  END IF;
END $$;


-- ─── 3. Extend appointments ───────────────────────────────────────────────────
-- Adds window-model fields.  All new columns are nullable for backward compat.
-- Existing rows keep scheduled_at and are unaffected.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='appointments' AND column_name='window'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN "window" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='appointments' AND column_name='window_label'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN window_label TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='appointments' AND column_name='scheduled_date'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN scheduled_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='appointments' AND column_name='confirmation_token'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN confirmation_token TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='appointments' AND column_name='confirmed_at'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='appointments' AND column_name='service_area_id'
  ) THEN
    ALTER TABLE public.appointments
      ADD COLUMN service_area_id UUID REFERENCES public.service_areas(id);
  END IF;
END $$;

-- Indexes for availability queries
CREATE INDEX IF NOT EXISTS appointments_scheduled_date_window_idx
  ON public.appointments (scheduled_date, "window")
  WHERE scheduled_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS appointments_service_area_date_idx
  ON public.appointments (service_area_id, scheduled_date)
  WHERE service_area_id IS NOT NULL AND scheduled_date IS NOT NULL;


-- ─── 4. Seed default business hours ──────────────────────────────────────────
-- Global defaults (service_area_id = NULL).
-- Monday–Friday: morning + afternoon.  Saturday: morning only.  Sunday: closed.
-- Uses ON CONFLICT to be idempotent.

INSERT INTO public.business_hours (day_of_week, is_operational, windows) VALUES
  -- Sunday (0) — closed
  (0, false, '[]'::jsonb),
  -- Monday (1)
  (1, true, '[
    {"id":"morning",   "label":"Morning (8AM–12PM)",   "start":"08:00","end":"12:00","max_jobs_per_tech":3},
    {"id":"afternoon", "label":"Afternoon (12PM–4PM)", "start":"12:00","end":"16:00","max_jobs_per_tech":3}
  ]'::jsonb),
  -- Tuesday (2)
  (2, true, '[
    {"id":"morning",   "label":"Morning (8AM–12PM)",   "start":"08:00","end":"12:00","max_jobs_per_tech":3},
    {"id":"afternoon", "label":"Afternoon (12PM–4PM)", "start":"12:00","end":"16:00","max_jobs_per_tech":3}
  ]'::jsonb),
  -- Wednesday (3)
  (3, true, '[
    {"id":"morning",   "label":"Morning (8AM–12PM)",   "start":"08:00","end":"12:00","max_jobs_per_tech":3},
    {"id":"afternoon", "label":"Afternoon (12PM–4PM)", "start":"12:00","end":"16:00","max_jobs_per_tech":3}
  ]'::jsonb),
  -- Thursday (4)
  (4, true, '[
    {"id":"morning",   "label":"Morning (8AM–12PM)",   "start":"08:00","end":"12:00","max_jobs_per_tech":3},
    {"id":"afternoon", "label":"Afternoon (12PM–4PM)", "start":"12:00","end":"16:00","max_jobs_per_tech":3}
  ]'::jsonb),
  -- Friday (5)
  (5, true, '[
    {"id":"morning",   "label":"Morning (8AM–12PM)",   "start":"08:00","end":"12:00","max_jobs_per_tech":3},
    {"id":"afternoon", "label":"Afternoon (12PM–4PM)", "start":"12:00","end":"16:00","max_jobs_per_tech":3}
  ]'::jsonb),
  -- Saturday (6) — morning only
  (6, true, '[
    {"id":"morning","label":"Morning (8AM–12PM)","start":"08:00","end":"12:00","max_jobs_per_tech":2}
  ]'::jsonb)
ON CONFLICT DO NOTHING;


-- ─── Verify ───────────────────────────────────────────────────────────────────
-- After running, confirm with:
--
-- SELECT day_of_week, is_operational, jsonb_array_length(windows) AS window_count
-- FROM public.business_hours
-- WHERE service_area_id IS NULL
-- ORDER BY day_of_week;
--
-- Expected: 7 rows — Sunday has 0 windows, Mon-Fri have 2, Saturday has 1.
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'appointments'
-- AND column_name IN ('window','window_label','scheduled_date','confirmation_token','confirmed_at','service_area_id');
-- Expected: 6 rows.
