-- ============================================================
-- MISSING TABLES — Apply this in Supabase SQL Editor
-- Run AFTER all prior migrations. Safe to run multiple times.
-- ============================================================

-- 1. invoices (referenced by payments FK — must exist before payments FK is re-added)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'paid', 'overdue', 'refunded', 'void')),
  due_date DATE,
  stripe_invoice_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all invoices" ON public.invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);

-- 2. pricing_rules (from admin features migration — may not have been applied)
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  acreage_min NUMERIC(10, 2),
  acreage_max NUMERIC(10, 2),
  zip TEXT,
  multiplier NUMERIC(10, 2) DEFAULT 1.0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins can do everything on pricing_rules"
  ON public.pricing_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Anyone can read active pricing_rules"
  ON public.pricing_rules FOR SELECT USING (active = true);

-- 3. service_areas (from admin features migration — may not have been applied)
CREATE TABLE IF NOT EXISTS public.service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  zips TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins can do everything on service_areas"
  ON public.service_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Anyone can read active service_areas"
  ON public.service_areas FOR SELECT USING (active = true);

-- 4. employees (employee portal — was in migration but not applied to DB)
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'technician'
    CHECK (role IN ('technician', 'dispatcher', 'admin')),
  phone TEXT,
  vehicle TEXT,
  default_nav TEXT DEFAULT 'google' CHECK (default_nav IN ('google', 'apple')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view their own record" ON public.employees
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all employees" ON public.employees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. shifts (employee time-tracking)
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  clock_in_at TIMESTAMPTZ,
  clock_out_at TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  notes TEXT
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can manage their own shifts" ON public.shifts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all shifts" ON public.shifts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. time_events (GPS clock events)
CREATE TABLE IF NOT EXISTS public.time_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('clock_in','clock_out','break_start','break_end',
                   'travel_start','travel_end','arrive','start_job','complete_job')
  ),
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geo JSONB,
  meta JSONB DEFAULT '{}'
);

ALTER TABLE public.time_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can manage their own time events" ON public.time_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shifts s
      JOIN public.employees e ON e.id = s.employee_id
      WHERE s.id = shift_id AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all time events" ON public.time_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 7. job_checklists, chemicals_logs, signatures (job artifact tables)
CREATE TABLE IF NOT EXISTS public.job_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  checklist JSONB NOT NULL DEFAULT '[]',
  completed_by UUID REFERENCES public.employees(id),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.job_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to job checklists" ON public.job_checklists
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.chemicals_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  epa_reg_no TEXT,
  notes TEXT
);

ALTER TABLE public.chemicals_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to chemicals logs" ON public.chemicals_logs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  signed_by TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'tech')),
  image_url TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access to signatures" ON public.signatures
  FOR ALL USING (auth.role() = 'authenticated');

-- 8. Ensure contact_inquiries exists (created in separate migration, repeat for safety)
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contact_inquiries' AND policyname = 'Anyone can submit contact inquiries'
  ) THEN
    CREATE POLICY "Anyone can submit contact inquiries" ON public.contact_inquiries
      FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contact_inquiries' AND policyname = 'Admins can read contact inquiries'
  ) THEN
    CREATE POLICY "Admins can read contact inquiries" ON public.contact_inquiries
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- 9. Indexes for common query patterns
CREATE INDEX IF NOT EXISTS employees_user_id_idx ON public.employees (user_id);
CREATE INDEX IF NOT EXISTS shifts_employee_id_idx ON public.shifts (employee_id);
CREATE INDEX IF NOT EXISTS shifts_shift_date_idx ON public.shifts (shift_date);
CREATE INDEX IF NOT EXISTS time_events_shift_id_idx ON public.time_events (shift_id);
CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON public.invoices (user_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);
