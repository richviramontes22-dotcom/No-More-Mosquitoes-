-- ─── Sprint 1: Worker Type + Test Employee Fields ────────────────────────────
-- Adds worker_type, is_test, emergency contact, and GPS consent tracking to employees.
-- Idempotent — safe to re-run.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='worker_type') THEN
    ALTER TABLE public.employees
      ADD COLUMN worker_type text NOT NULL DEFAULT 'employee'
        CHECK (worker_type IN ('employee', 'contractor', 'vendor', 'test'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='is_test') THEN
    ALTER TABLE public.employees ADD COLUMN is_test boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='emergency_contact_name') THEN
    ALTER TABLE public.employees ADD COLUMN emergency_contact_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='emergency_contact_phone') THEN
    ALTER TABLE public.employees ADD COLUMN emergency_contact_phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='emergency_contact_relation') THEN
    ALTER TABLE public.employees ADD COLUMN emergency_contact_relation text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='gps_consent_at') THEN
    ALTER TABLE public.employees ADD COLUMN gps_consent_at timestamptz;
  END IF;
END $$;

-- Index for test employee lookups
CREATE INDEX IF NOT EXISTS idx_employees_is_test ON public.employees (is_test) WHERE is_test = true;
CREATE INDEX IF NOT EXISTS idx_employees_worker_type ON public.employees (worker_type);
