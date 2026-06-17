-- ============================================================
-- Promo Codes + Campaigns + usage-counter RPC
--
-- This schema already backs server/routes/adminPromos.ts,
-- server/routes/marketplaceStripe.ts, and server/routes/billingStripe.ts
-- in this codebase, but no migration file for it existed under
-- db/migrations/ — it was applied to Supabase ad hoc, outside this
-- project's tracked-migration convention. This file backfills that
-- record. Every statement is idempotent (IF NOT EXISTS / CREATE OR
-- REPLACE), so it is safe to run whether or not the tables already
-- exist in a given environment.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      TEXT        NOT NULL UNIQUE,
  description               TEXT,
  discount_type             TEXT        NOT NULL, -- 'percent' | 'fixed'
  discount_value            NUMERIC     NOT NULL,  -- percent: 0-100; fixed: dollars
  min_order_cents           INTEGER     NOT NULL DEFAULT 0,
  max_uses                  INTEGER,
  used_count                INTEGER     NOT NULL DEFAULT 0,
  expires_at                TIMESTAMPTZ,
  active                    BOOLEAN     NOT NULL DEFAULT TRUE,
  stripe_coupon_id          TEXT,
  stripe_promotion_code_id  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS promo_codes_code_idx   ON public.promo_codes (code);
CREATE INDEX IF NOT EXISTS promo_codes_active_idx ON public.promo_codes (active);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Admin CRUD (server/routes/adminPromos.ts admin endpoints) — mirrors the
-- admin-only policy convention from 2026-06-15_create_leads_tables.sql.
DROP POLICY IF EXISTS promo_codes_admin_only ON public.promo_codes;
CREATE POLICY promo_codes_admin_only ON public.promo_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Public read of active codes only — required so /api/promos/validate (a
-- public, unauthenticated endpoint) keeps working in any environment where
-- SUPABASE_SERVICE_ROLE_KEY isn't set and the server falls back to the anon
-- client (see `const db = supabaseAdmin ?? supabase` in adminPromos.ts).
-- service_role itself bypasses RLS entirely, so this only matters for that
-- fallback path. Mirrors the "Anyone can read active service_areas" policy
-- in 2025-05-20_admin_features_support.sql.
DROP POLICY IF EXISTS promo_codes_public_read_active ON public.promo_codes;
CREATE POLICY promo_codes_public_read_active ON public.promo_codes
  FOR SELECT
  USING (active = true);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  promo_code_id UUID        REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  start_date    DATE,
  end_date      DATE,
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin-only — no public endpoint reads campaigns directly.
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_admin_only ON public.campaigns;
CREATE POLICY campaigns_admin_only ON public.campaigns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Atomic increment used by server/routes/webhooksStripe.ts (marketplace flow)
-- and server/routes/billingStripe.ts confirm-booking (onboarding flow) after a
-- confirmed successful payment. Both call sites fall back to a non-atomic
-- read-then-write if this RPC is missing, so this function is an optimization,
-- not a hard dependency — but defining it closes a race condition under
-- concurrent redemptions of the same code.
--
-- SECURITY DEFINER is required: webhooksStripe.ts calls this via the anon
-- client (`supabase.rpc(...)`, not `supabaseAdmin`), and now that RLS is
-- enabled above with no anon/authenticated UPDATE policy, a plain
-- SECURITY INVOKER function would have its internal UPDATE silently blocked
-- for that caller. Running as the function owner bypasses RLS for this one
-- narrow, audited operation (increment by exactly 1, only on active rows)
-- without granting anon/authenticated any direct UPDATE access to the table.
--
-- DROP first: an earlier ad-hoc version of this function may already exist
-- with a different return type (e.g. if it was first created returning
-- INTEGER or similar) — CREATE OR REPLACE cannot change a function's return
-- type, only DROP + CREATE can. IF EXISTS makes this safe to re-run whether
-- or not a prior version is present.
DROP FUNCTION IF EXISTS public.increment_promo_used_count(UUID);

CREATE FUNCTION public.increment_promo_used_count(promo_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.promo_codes
  SET used_count = used_count + 1,
      updated_at = NOW()
  WHERE id = promo_id AND active = TRUE;
$$;

GRANT EXECUTE ON FUNCTION public.increment_promo_used_count(UUID) TO anon, authenticated, service_role;
