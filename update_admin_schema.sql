-- Migration to support all admin panel features
-- Adds missing tables (tickets, invoices) and columns (properties.label, properties.state, appointments start/end, profile status, etc.)

-- 1. Add missing columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. Add missing columns to properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS state TEXT;

-- 3. Add missing columns to appointments
-- We use TIMESTAMPTZ for start and end times for better timezone handling
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;

-- 4. Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  property_id UUID REFERENCES public.properties(id),
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  status TEXT DEFAULT 'open', -- open, in_progress, resolved, closed
  assigned_to UUID REFERENCES auth.users(id),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create invoices table (if not relying solely on Stripe)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  stripe_invoice_id TEXT, -- Reference to Stripe if applicable
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'open', -- open, paid, overdue, void, uncollectible, refunded
  description TEXT,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Update message_threads to support customer-level threads
ALTER TABLE public.message_threads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 7. Add unread_count to message_threads (optional but helpful for performance)
ALTER TABLE public.message_threads ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- 8. Enable RLS on new tables
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 9. Basic RLS Policies for Admin Access
-- Note: These assume an 'admin' role exists in profiles.role

-- Tickets: Admins can do everything
CREATE POLICY admin_all_tickets ON public.tickets
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tickets: Users can see their own tickets
CREATE POLICY user_view_own_tickets ON public.tickets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Invoices: Admins can do everything
CREATE POLICY admin_all_invoices ON public.invoices
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Invoices: Users can see their own invoices
CREATE POLICY user_view_own_invoices ON public.invoices
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 10. Update existing tables RLS for admin
-- Properties
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'properties' AND policyname = 'admin_all_properties'
    ) THEN
        CREATE POLICY admin_all_properties ON public.properties
          FOR ALL
          TO authenticated
          USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
          WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    END IF;
END $$;

-- Appointments
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'appointments' AND policyname = 'admin_all_appointments'
    ) THEN
        CREATE POLICY admin_all_appointments ON public.appointments
          FOR ALL
          TO authenticated
          USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
          WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    END IF;
END $$;
