-- Admin Features Support Migration
-- This migration adds missing tables and columns to support all admin panel features

-- 1. Plans & Pricing
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    tier TEXT,
    cadence_days INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 2. Service Areas
CREATE TABLE IF NOT EXISTS public.service_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    zips TEXT[] DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Payments (to track Stripe transactions)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id),
    user_id UUID REFERENCES auth.users(id),
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_charge_id TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL, -- 'succeeded', 'failed', 'refunded', etc.
    method TEXT, -- 'card', 'bank_transfer', etc.
    refund_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Subscriptions (local mapping for Stripe subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    property_id UUID, -- Link to property if needed
    stripe_subscription_id TEXT UNIQUE,
    plan_id UUID REFERENCES public.plans(id),
    status TEXT NOT NULL, -- 'active', 'past_due', 'canceled', etc.
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Normalize Properties table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='address1') THEN
        ALTER TABLE public.properties RENAME COLUMN address TO address1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='city') THEN
        ALTER TABLE public.properties ADD COLUMN city TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='state') THEN
        ALTER TABLE public.properties ADD COLUMN state TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='label') THEN
        ALTER TABLE public.properties ADD COLUMN label TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='is_default') THEN
        ALTER TABLE public.properties ADD COLUMN is_default BOOLEAN DEFAULT false;
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
        ALTER TABLE public.properties ADD COLUMN price DECIMAL(10, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='gate_code') THEN
        ALTER TABLE public.properties ADD COLUMN gate_code TEXT;
    END IF;
END $$;

-- 6. Normalize Appointments table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='service_type') THEN
        ALTER TABLE public.appointments ADD COLUMN service_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='frequency') THEN
        ALTER TABLE public.appointments ADD COLUMN frequency TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='technician_id') THEN
        ALTER TABLE public.appointments ADD COLUMN technician_id UUID; -- REFERENCES profiles(id) if needed
    END IF;
END $$;

-- 7. Add RLS Policies for new tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can do everything on plans" ON public.plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can do everything on pricing_rules" ON public.pricing_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can do everything on service_areas" ON public.service_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can do everything on payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can do everything on subscriptions" ON public.subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public/Authenticated read policies for specific tables
CREATE POLICY "Anyone can read active plans" ON public.plans FOR SELECT USING (active = true);
CREATE POLICY "Anyone can read active pricing_rules" ON public.pricing_rules FOR SELECT USING (active = true);
CREATE POLICY "Anyone can read active service_areas" ON public.service_areas FOR SELECT USING (active = true);
