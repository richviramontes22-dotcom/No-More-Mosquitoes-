-- ─── Phase 3A: Employee Assignment Persistence ───────────────────────────────
-- Adds lifecycle timestamp columns to assignments table.
-- Existing columns (arrive_at, start_at, complete_at) are preserved.
-- New columns match the names expected by client code.
-- Safe to re-run: uses DO $$ guards throughout.

DO $$ BEGIN
  -- en_route_at: set when technician marks themselves as en route
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='assignments' AND column_name='en_route_at'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN en_route_at TIMESTAMPTZ;
  END IF;

  -- arrived_at: set when technician marks arrival at property
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='assignments' AND column_name='arrived_at'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN arrived_at TIMESTAMPTZ;
  END IF;

  -- started_at: client-facing name for job start (mirrors start_at)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='assignments' AND column_name='started_at'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN started_at TIMESTAMPTZ;
  END IF;

  -- completed_at: client-facing name for job completion (mirrors complete_at)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='assignments' AND column_name='completed_at'
  ) THEN
    ALTER TABLE public.assignments ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS assignments_employee_id_idx
  ON public.assignments (employee_id)
  WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS assignments_appointment_id_idx
  ON public.assignments (appointment_id);

CREATE INDEX IF NOT EXISTS assignments_status_idx
  ON public.assignments (status);

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'assignments'
-- AND column_name IN ('en_route_at','arrived_at','started_at','completed_at')
-- ORDER BY column_name;
-- Expected: 4 rows.
