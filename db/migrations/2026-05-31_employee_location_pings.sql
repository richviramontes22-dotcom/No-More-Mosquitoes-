-- ─── Sprint 2: Employee GPS Location Pings ────────────────────────────────────
-- Creates employee_location_pings table for snapshot GPS capture.
-- GPS is only stored when employee.gps_consent_at IS NOT NULL.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.employee_location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  latitude decimal(10, 7) NOT NULL,
  longitude decimal(10, 7) NOT NULL,
  accuracy_meters decimal(8, 2),
  speed_mps decimal(8, 2),
  heading_degrees decimal(6, 2),
  captured_at timestamptz NOT NULL DEFAULT now(),
  -- status that triggered the ping: 'en_route', 'arrived', 'completed', 'skipped', 'no_show'
  status_trigger text,
  -- 'browser' = real device GPS; 'simulated' = test employee only
  source text NOT NULL DEFAULT 'browser'
    CHECK (source IN ('browser', 'simulated')),
  is_test boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_location_pings_employee
  ON public.employee_location_pings (employee_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_pings_assignment
  ON public.employee_location_pings (assignment_id, captured_at DESC);

-- Enable RLS — admin reads all; employee reads own
ALTER TABLE public.employee_location_pings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employee_location_pings' AND policyname = 'employee_location_pings_admin'
  ) THEN
    CREATE POLICY employee_location_pings_admin ON public.employee_location_pings
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employee_location_pings' AND policyname = 'employee_location_pings_self'
  ) THEN
    CREATE POLICY employee_location_pings_self ON public.employee_location_pings
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.employees WHERE id = employee_location_pings.employee_id AND user_id = auth.uid())
      );
  END IF;
END $$;
