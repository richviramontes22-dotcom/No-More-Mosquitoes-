-- ============================================================
-- Referral Program Foundation
--
-- referral_codes  — one per customer (auto-generated) or partner (admin-created)
-- referrals       — attribution: which lead/customer came in via which code
-- referral_rewards — ledger of owed/issued rewards per referral
--
-- See REFERRAL_PROGRAM_DESIGN_REPORT.md for scope decisions (no quotes
-- table exists — lead_id is the persistent quote-equivalent record;
-- conversion + reward issuance are manual admin actions, not automatic
-- Stripe-webhook hooks).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   TEXT        NOT NULL UNIQUE,
  owner_type             TEXT        NOT NULL CHECK (owner_type IN ('customer', 'partner')),
  customer_id            UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner_name           TEXT,
  partner_type           TEXT        CHECK (partner_type IN ('hoa', 'property_manager', 'landscaper', 'realtor', 'pest_control', 'other')),
  partner_contact_email  TEXT,
  partner_contact_phone  TEXT,
  active                 BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_codes_owner_shape CHECK (
    (owner_type = 'customer' AND customer_id IS NOT NULL)
    OR
    (owner_type = 'partner' AND partner_name IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS referral_codes_code_idx ON public.referral_codes (code);
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_one_per_customer
  ON public.referral_codes (customer_id) WHERE owner_type = 'customer';

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_codes_admin_only ON public.referral_codes;
CREATE POLICY referral_codes_admin_only ON public.referral_codes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Public read of active codes only — required for the unauthenticated
-- /api/referrals/validate endpoint to work when SUPABASE_SERVICE_ROLE_KEY
-- isn't configured and the server falls back to the anon client. Mirrors
-- promo_codes_public_read_active in 2026-06-17_promo_codes_and_campaigns.sql.
DROP POLICY IF EXISTS referral_codes_public_read_active ON public.referral_codes;
CREATE POLICY referral_codes_public_read_active ON public.referral_codes
  FOR SELECT
  USING (active = true);

CREATE TABLE IF NOT EXISTS public.referrals (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id        UUID        NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  lead_id                 UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  referred_customer_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointment_id          UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  subscription_id         UUID        REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  conversion_value_cents  INTEGER,
  status                  TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'rewarded', 'invalid')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS referrals_code_idx   ON public.referrals (referral_code_id);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON public.referrals (status);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_one_per_lead
  ON public.referrals (lead_id) WHERE lead_id IS NOT NULL;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referrals_admin_only ON public.referrals;
CREATE POLICY referrals_admin_only ON public.referrals
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id   UUID        NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  reward_type   TEXT        NOT NULL CHECK (reward_type IN ('account_credit', 'service_credit', 'free_service', 'manual_reward')),
  amount_cents  INTEGER,
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'issued', 'denied')),
  notes         TEXT,
  approved_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS referral_rewards_referral_idx ON public.referral_rewards (referral_id);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_rewards_admin_only ON public.referral_rewards;
CREATE POLICY referral_rewards_admin_only ON public.referral_rewards
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Reuse the shared updated_at trigger function (defined in 2026-06-15_create_leads_tables.sql;
-- CREATE OR REPLACE here makes this migration runnable standalone too).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS referral_codes_updated_at ON public.referral_codes;
CREATE TRIGGER referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS referrals_updated_at ON public.referrals;
CREATE TRIGGER referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS referral_rewards_updated_at ON public.referral_rewards;
CREATE TRIGGER referral_rewards_updated_at
  BEFORE UPDATE ON public.referral_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
