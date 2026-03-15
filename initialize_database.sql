-- COMPREHENSIVE DATABASE INITIALIZATION & MOCK DATA SEED
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. CREATE TABLES (if they don't exist)

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  phone TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  card_expiry TEXT
);

-- ENSURE missing columns in 'profiles' exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='card_brand') THEN
    ALTER TABLE public.profiles ADD COLUMN card_brand TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='card_last4') THEN
    ALTER TABLE public.profiles ADD COLUMN card_last4 TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='card_expiry') THEN
    ALTER TABLE public.profiles ADD COLUMN card_expiry TEXT;
  END IF;
END $$;

-- Properties table
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  zip TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENSURE missing columns in 'properties' exist (since the table might already exist with a partial schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='city') THEN
    ALTER TABLE public.properties ADD COLUMN city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='acreage') THEN
    ALTER TABLE public.properties ADD COLUMN acreage DECIMAL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='notes') THEN
    ALTER TABLE public.properties ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='is_default') THEN
    ALTER TABLE public.properties ADD COLUMN is_default BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='plan') THEN
    ALTER TABLE public.properties ADD COLUMN plan TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='program') THEN
    ALTER TABLE public.properties ADD COLUMN program TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='cadence') THEN
    ALTER TABLE public.properties ADD COLUMN cadence INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='price') THEN
    ALTER TABLE public.properties ADD COLUMN price DECIMAL;
  END IF;
END $$;

-- Appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'requested', -- requested, scheduled, confirmed, completed, canceled
  scheduled_at TIMESTAMPTZ,
  service_type TEXT DEFAULT 'Mosquito Service',
  frequency TEXT DEFAULT 'One-time',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments table (Technicians assigned to appointments)
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'assigned', -- assigned, in_progress, completed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Media (Videos/Photos from visits)
CREATE TABLE IF NOT EXISTS public.job_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  media_type TEXT DEFAULT 'video', -- video, image
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Threads
CREATE TABLE IF NOT EXISTS public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  customer_visible BOOLEAN DEFAULT TRUE,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. CREATE RLS POLICIES (Simple versions for development)

-- Profiles: Users can view/update their own
DO $$ BEGIN
  CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
  CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Properties: Users can view/manage their own
DO $$ BEGIN
  CREATE POLICY "Users can manage own properties" ON public.properties FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Appointments: Users can view their own
DO $$ BEGIN
  CREATE POLICY "Users can view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can insert own appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Assignments/Media/Messages: Allow authenticated users to view
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view assignments" ON public.assignments FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY "Authenticated users can view job_media" ON public.job_media FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY "Authenticated users can view threads" ON public.message_threads FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY "Authenticated users can view messages" ON public.messages FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. SEED MOCK DATA FOR ADMIN ACCOUNT
-- This section attempts to find the admin user and seed data for it.

DO $$
DECLARE
    admin_id UUID;
    prop_id UUID;
    appt_id UUID;
    assign_id UUID;
    thread_id UUID;
BEGIN
    -- 1. Try to find the admin user by email
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@nnm.com' LIMIT 1;
    
    IF admin_id IS NOT NULL THEN
        -- 2. Ensure profile exists
        INSERT INTO public.profiles (id, name, email, phone, role, card_brand, card_last4, card_expiry)
        VALUES (admin_id, 'Elijah Noble', 'admin@nnm.com', '(949) 555-0123', 'admin', 'Visa', '4242', '12/2026')
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            role = 'admin',
            card_brand = 'Visa',
            card_last4 = '4242',
            card_expiry = '12/2026';

        -- 3. Seed Properties
        INSERT INTO public.properties (user_id, address, zip, city, acreage, notes, is_default, plan, program, cadence, price)
        VALUES (admin_id, '18 Ocean Vista, Newport Beach, CA 92657', '92657', 'Newport Beach', 0.25, 'Gate: 1234 | Backyard slope; dog in yard.', TRUE, '.21 - .30 acres', 'subscription', 30, 125.00)
        RETURNING id INTO prop_id;

        INSERT INTO public.properties (user_id, address, zip, city, acreage, notes, is_default, plan, program, cadence, price)
        VALUES (admin_id, '42 Palm Terrace, Laguna Beach, CA 92651', '92651', 'Laguna Beach', 0.15, 'Gate: 5678 | Front yard only.', FALSE, '.14 - .20 acres', 'subscription', 30, 110.00);

        -- 4. Seed Appointments
        -- Upcoming
        INSERT INTO public.appointments (user_id, property_id, status, scheduled_at, service_type, frequency, notes)
        VALUES (admin_id, prop_id, 'scheduled', NOW() + INTERVAL '2 days', 'Mosquito Service', 'Monthly', 'Slot: 10:00 AM - 12:00 PM | Please treat the ivy wall.')
        RETURNING id INTO appt_id;

        -- Completed
        INSERT INTO public.appointments (user_id, property_id, status, scheduled_at, service_type, frequency, notes)
        VALUES (admin_id, prop_id, 'completed', NOW() - INTERVAL '14 days', 'Mosquito Service', 'Monthly', 'Slot: 8:00 AM - 10:00 AM | Routine monthly visit.')
        RETURNING id INTO appt_id;

        -- 5. Seed Assignment for Completed Job
        INSERT INTO public.assignments (appointment_id, employee_id, status, started_at, completed_at)
        VALUES (appt_id, admin_id, 'completed', NOW() - INTERVAL '14 days' - INTERVAL '1 hour', NOW() - INTERVAL '14 days')
        RETURNING id INTO assign_id;

        -- 6. Seed Job Media (Video)
        INSERT INTO public.job_media (assignment_id, media_type, url, caption)
        VALUES (assign_id, 'video', 'https://vimeo.com/showcase/9876543', 'Confirmed treatment of entire perimeter and standing water source in back left corner.');

        -- 7. Seed Message Thread
        INSERT INTO public.message_threads (assignment_id, customer_visible, last_activity_at)
        VALUES (assign_id, TRUE, NOW() - INTERVAL '14 days' + INTERVAL '2 hours')
        RETURNING id INTO thread_id;

        -- 8. Seed Messages
        INSERT INTO public.messages (thread_id, sender_id, body)
        VALUES (thread_id, admin_id, 'Technician on the way! I have the gate code from your notes.');

        INSERT INTO public.messages (thread_id, sender_id, body)
        VALUES (thread_id, admin_id, 'Service complete. The backyard gate is locked as requested. Check out the visit recap video!');

        RAISE NOTICE 'Seeded data for admin@nnm.com (ID: %)', admin_id;
    ELSE
        RAISE NOTICE 'Admin user admin@nnm.com not found in auth.users. Please sign up first.';
    END IF;
END $$;
