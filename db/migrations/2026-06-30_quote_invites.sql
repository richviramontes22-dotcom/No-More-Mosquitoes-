-- ============================================================
-- Quote Invite System
--
-- A dedicated table for quote invitations sent from the admin
-- Quote Lookup tool. Keeps invite state (pending/accepted/expired/
-- revoked) separate from the leads table, supports multiple
-- invites for the same lead (resend / updated quote), and provides
-- a clean audit trail.
--
-- The token stored here is the raw opaque token (base64url, 32 bytes
-- of randomness) — not a hash. The token is treated as a secret
-- URL parameter; only the public-facing endpoint receives it and
-- should validate expiry+status before returning any data.
--
-- Relationship to leads:
--   A lead may have zero or many quote_invites. The most recent
--   active (status=pending, not expired) invite is the one in use.
--   Each new send-quote call creates a new row and optionally
--   deactivates previous ones.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quote_invites (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID        REFERENCES public.leads(id) ON DELETE CASCADE,
  token               TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','accepted','expired','revoked')),

  -- Quote snapshot at time of send — preserved even if lead row changes later
  quote_address       TEXT        NOT NULL,
  quote_city          TEXT,
  quote_state         TEXT,
  quote_zip           TEXT,
  quote_plan_type     TEXT,        -- 'subscription' | 'one_time' | 'annual'
  quote_cadence_days  INTEGER,     -- subscription cadence; null for one_time/annual
  quote_price_cents   INTEGER,
  quoted_acreage      NUMERIC(10, 4),
  price_label         TEXT,        -- formatted string, e.g. "$80 every 3 weeks"
  program_label       TEXT,        -- display name, e.g. "Recurring Service"

  -- Customer info at time of send (admin-entered, may be partial)
  customer_name       TEXT,
  customer_email      TEXT,
  customer_phone      TEXT,

  -- Admin who sent this invite
  sent_by             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Timestamps
  expires_at          TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token must be globally unique across all invites
CREATE UNIQUE INDEX IF NOT EXISTS quote_invites_token_idx ON public.quote_invites (token);

-- Fast lookup for a specific lead's invite history
CREATE INDEX IF NOT EXISTS quote_invites_lead_id_idx ON public.quote_invites (lead_id);
CREATE INDEX IF NOT EXISTS quote_invites_status_idx  ON public.quote_invites (status);

-- Keep updated_at current
DROP TRIGGER IF EXISTS quote_invites_updated_at ON public.quote_invites;
CREATE TRIGGER quote_invites_updated_at
  BEFORE UPDATE ON public.quote_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: only admins can see/manage invites
ALTER TABLE public.quote_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY quote_invites_admin_only ON public.quote_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Also track invite_accepted_at on the leads table so the Lead Inbox
-- can show accepted/converted status without joining quote_invites.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS invite_accepted_at TIMESTAMPTZ;
