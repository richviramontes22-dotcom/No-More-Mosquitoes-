-- ============================================================
-- Referral Automation Phase 2
--
-- 1. referrals.status — add 'conversion_candidate' (detected, not yet
--    admin-reviewed) between 'pending' and 'converted'.
-- 2. referral_reward_settings — singleton config, disabled by default.
--    auto_create_rewards only ever creates a PENDING reward ROW (a ledger
--    entry) — it never issues a reward, applies a credit, or touches
--    Stripe. Issuing remains a separate, always-manual admin action via the
--    existing referral_rewards.status workflow (pending -> approved -> issued).
-- ============================================================

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_status_check
  CHECK (status IN ('pending', 'conversion_candidate', 'converted', 'rewarded', 'invalid'));

CREATE TABLE IF NOT EXISTS public.referral_reward_settings (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled                     BOOLEAN     NOT NULL DEFAULT FALSE,
  customer_reward_type        TEXT        NOT NULL DEFAULT 'account_credit'
                                           CHECK (customer_reward_type IN ('account_credit', 'service_credit', 'free_service', 'manual_reward')),
  customer_reward_amount_cents INTEGER,
  partner_reward_type         TEXT        NOT NULL DEFAULT 'manual_reward'
                                           CHECK (partner_reward_type IN ('account_credit', 'service_credit', 'free_service', 'manual_reward')),
  partner_reward_amount_cents INTEGER,
  auto_create_rewards         BOOLEAN     NOT NULL DEFAULT FALSE,
  require_admin_approval      BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_by                  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.referral_reward_settings (enabled)
SELECT FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.referral_reward_settings);

ALTER TABLE public.referral_reward_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_reward_settings_admin_only ON public.referral_reward_settings;
CREATE POLICY referral_reward_settings_admin_only ON public.referral_reward_settings
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS referral_reward_settings_updated_at ON public.referral_reward_settings;
CREATE TRIGGER referral_reward_settings_updated_at
  BEFORE UPDATE ON public.referral_reward_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
