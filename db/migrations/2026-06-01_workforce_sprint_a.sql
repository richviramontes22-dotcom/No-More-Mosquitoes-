-- ─── Workforce Sprint A: Availability Foundation ────────────────────────────
-- Creates technician schedule, date override, and capacity tables.
-- Extends employees table. Fixes service_areas schema mismatch.
-- Idempotent — safe to re-run.

-- ── 1. employees table extensions ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='hire_date') THEN
    ALTER TABLE public.employees ADD COLUMN hire_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='default_max_stops') THEN
    ALTER TABLE public.employees ADD COLUMN default_max_stops int DEFAULT 8;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='service_area_ids') THEN
    ALTER TABLE public.employees ADD COLUMN service_area_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

-- ── 2. service_areas schema fix (API expects these columns) ───────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_areas' AND column_name='city') THEN
    ALTER TABLE public.service_areas ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_areas' AND column_name='state') THEN
    ALTER TABLE public.service_areas ADD COLUMN state text DEFAULT 'CA';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_areas' AND column_name='capacity') THEN
    ALTER TABLE public.service_areas ADD COLUMN capacity int DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_areas' AND column_name='is_active') THEN
    ALTER TABLE public.service_areas ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_areas' AND column_name='updated_at') THEN
    ALTER TABLE public.service_areas ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ── 3. technician_schedule_templates ─────────────────────────────────────────
-- Defines each technician's recurring weekly work schedule.
CREATE TABLE IF NOT EXISTS public.technician_schedule_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0=Sunday, 1=Monday, ..., 6=Saturday
  is_working boolean NOT NULL DEFAULT true,
  work_start time,           -- e.g., '08:00'
  work_end   time,           -- e.g., '17:00'
  max_stops  int,            -- per-day override; NULL = use capacity profile or global
  notes text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,      -- NULL = indefinite
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, day_of_week, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_employee
  ON public.technician_schedule_templates (employee_id, day_of_week);

ALTER TABLE public.technician_schedule_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='technician_schedule_templates' AND policyname='schedule_templates_admin') THEN
    CREATE POLICY schedule_templates_admin ON public.technician_schedule_templates
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='technician_schedule_templates' AND policyname='schedule_templates_employee_read') THEN
    CREATE POLICY schedule_templates_employee_read ON public.technician_schedule_templates
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.employees WHERE id = technician_schedule_templates.employee_id AND user_id = auth.uid())
      );
  END IF;
END $$;

-- ── 4. technician_date_overrides ──────────────────────────────────────────────
-- One-off date-specific availability exceptions (not PTO — just schedule changes).
CREATE TABLE IF NOT EXISTS public.technician_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  is_available boolean NOT NULL DEFAULT false,
  work_start time,
  work_end time,
  max_stops_override int,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, override_date)
);

CREATE INDEX IF NOT EXISTS idx_date_overrides_employee_date
  ON public.technician_date_overrides (employee_id, override_date);

CREATE INDEX IF NOT EXISTS idx_date_overrides_date
  ON public.technician_date_overrides (override_date);

ALTER TABLE public.technician_date_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='technician_date_overrides' AND policyname='date_overrides_admin') THEN
    CREATE POLICY date_overrides_admin ON public.technician_date_overrides
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='technician_date_overrides' AND policyname='date_overrides_employee_read') THEN
    CREATE POLICY date_overrides_employee_read ON public.technician_date_overrides
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.employees WHERE id = technician_date_overrides.employee_id AND user_id = auth.uid())
      );
  END IF;
END $$;

-- ── 5. technician_capacity_profiles ──────────────────────────────────────────
-- Per-technician workload limits and service qualifications.
CREATE TABLE IF NOT EXISTS public.technician_capacity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  max_stops_per_day int NOT NULL DEFAULT 8,
  max_service_minutes_per_day int,   -- NULL = no limit
  max_drive_minutes_per_day int,     -- NULL = no limit
  allowed_service_types text[] DEFAULT '{}',   -- empty = all types allowed
  skill_level text DEFAULT 'standard'
    CHECK (skill_level IN ('junior', 'standard', 'senior', 'specialist')),
  is_licensed_applicator boolean NOT NULL DEFAULT false,
  preferred_service_area_ids uuid[] DEFAULT '{}',   -- empty = no preference
  home_base_lat decimal(10, 7),
  home_base_lng decimal(10, 7),
  home_base_address text,
  vehicle_type text,
  equipment_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.technician_capacity_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='technician_capacity_profiles' AND policyname='capacity_profiles_admin') THEN
    CREATE POLICY capacity_profiles_admin ON public.technician_capacity_profiles
      FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='technician_capacity_profiles' AND policyname='capacity_profiles_employee_read') THEN
    CREATE POLICY capacity_profiles_employee_read ON public.technician_capacity_profiles
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.employees WHERE id = technician_capacity_profiles.employee_id AND user_id = auth.uid())
      );
  END IF;
END $$;
