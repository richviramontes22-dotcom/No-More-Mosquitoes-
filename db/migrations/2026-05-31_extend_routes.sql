-- ─── Extend routes and route_stops to match application code ────────────────
-- Renames legacy columns and adds missing lifecycle/metadata columns.
-- Idempotent — safe to re-run.

-- ── 1. routes table ──────────────────────────────────────────────────────────

-- Rename route_date → date (application code uses 'date')
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='routes' AND column_name='route_date')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='routes' AND column_name='date')
  THEN
    ALTER TABLE public.routes RENAME COLUMN route_date TO date;
  END IF;
END $$;

-- If route_date was already 'date' or table only has 'date', add 'date' if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='routes' AND column_name='date')
  THEN
    ALTER TABLE public.routes ADD COLUMN date date NOT NULL DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Drop the old status check constraint and recreate with full set of statuses
ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_status_check;
ALTER TABLE public.routes ADD CONSTRAINT routes_status_check
  CHECK (status IN ('draft','approved','assigned','published','in_progress','completed','canceled'));

-- Set a safe default for status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='routes' AND column_name='status'
    AND column_default IS NOT NULL)
  THEN
    ALTER TABLE public.routes ALTER COLUMN status SET DEFAULT 'draft';
  END IF;
END $$;

-- Add lifecycle and metadata columns to routes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='created_by') THEN
    ALTER TABLE public.routes ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='approved_at') THEN
    ALTER TABLE public.routes ADD COLUMN approved_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='approved_by') THEN
    ALTER TABLE public.routes ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='published_at') THEN
    ALTER TABLE public.routes ADD COLUMN published_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='locked_at') THEN
    ALTER TABLE public.routes ADD COLUMN locked_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='total_distance_miles') THEN
    ALTER TABLE public.routes ADD COLUMN total_distance_miles decimal(8,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='total_duration_minutes') THEN
    ALTER TABLE public.routes ADD COLUMN total_duration_minutes decimal(8,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='algorithm_version') THEN
    ALTER TABLE public.routes ADD COLUMN algorithm_version text DEFAULT 'nearest-neighbor-v1';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='confidence') THEN
    ALTER TABLE public.routes ADD COLUMN confidence text CHECK (confidence IN ('high','medium','low'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='routes' AND column_name='conflict_notes') THEN
    ALTER TABLE public.routes ADD COLUMN conflict_notes text[];
  END IF;
END $$;

-- ── 2. route_stops table ──────────────────────────────────────────────────────

-- Rename seq → sequence_number
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='route_stops' AND column_name='seq')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='route_stops' AND column_name='sequence_number')
  THEN
    ALTER TABLE public.route_stops RENAME COLUMN seq TO sequence_number;
  END IF;
END $$;

-- Rename eta → arrival_eta
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='route_stops' AND column_name='eta')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='route_stops' AND column_name='arrival_eta')
  THEN
    ALTER TABLE public.route_stops RENAME COLUMN eta TO arrival_eta;
  END IF;
END $$;

-- Update route_stops status CHECK to include 'pending' and 'arrived'
ALTER TABLE public.route_stops DROP CONSTRAINT IF EXISTS route_stops_status_check;
ALTER TABLE public.route_stops ADD CONSTRAINT route_stops_status_check
  CHECK (status IN ('pending','scheduled','arrived','skipped','completed'));

-- Set default for route_stops.status to 'pending'
ALTER TABLE public.route_stops ALTER COLUMN status SET DEFAULT 'pending';

-- Add missing columns to route_stops
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_stops' AND column_name='departure_eta') THEN
    ALTER TABLE public.route_stops ADD COLUMN departure_eta timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_stops' AND column_name='distance_from_prev_miles') THEN
    ALTER TABLE public.route_stops ADD COLUMN distance_from_prev_miles decimal(8,3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_stops' AND column_name='duration_from_prev_minutes') THEN
    ALTER TABLE public.route_stops ADD COLUMN duration_from_prev_minutes decimal(8,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_stops' AND column_name='appointment_id') THEN
    ALTER TABLE public.route_stops ADD COLUMN appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_stops' AND column_name='estimated_duration_minutes') THEN
    ALTER TABLE public.route_stops ADD COLUMN estimated_duration_minutes int DEFAULT 45;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='route_stops' AND column_name='notes') THEN
    ALTER TABLE public.route_stops ADD COLUMN notes text;
  END IF;
END $$;

-- ── 3. route_audit_log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.route_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  -- 'route_generated','route_approved','route_published','route_rebuilt',
  -- 'route_completed','route_canceled','stop_reordered','stop_updated'
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_audit_route ON public.route_audit_log (route_id, created_at DESC);

-- RLS: admin-only
ALTER TABLE public.route_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'route_audit_log' AND policyname = 'route_audit_log_admin'
  ) THEN
    CREATE POLICY route_audit_log_admin ON public.route_audit_log
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_routes_employee_date ON public.routes (employee_id, date);
CREATE INDEX IF NOT EXISTS idx_routes_status ON public.routes (status);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON public.route_stops (route_id, sequence_number);
