-- ─── Profile Card Fields ───────────────────────────────────────────────────────
-- Stores real card details synced from Stripe after a successful payment.
-- Values are set by the server (webhooksStripe, billingStripe) — never the client.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS card_last4  text,
  ADD COLUMN IF NOT EXISTS card_brand  text,
  ADD COLUMN IF NOT EXISTS card_expiry text;
