-- ============================================================
-- Admin Quote Lookup tool: shareable quote link
--
-- An admin can look up a prospect's address, generate a quote, and email/
-- text them a link to finish signing up themselves with that address/plan
-- pre-filled (server/routes/adminLeads.ts POST /quote and /:id/send-quote,
-- GET /api/leads/quote-link/:token). The link carries an opaque random
-- token rather than the lead's UUID, so a quote/address/price isn't
-- guessable via a sequential or otherwise-exposed id.
-- ============================================================

-- city/state: the leads table has never stored these (upsertLeadFromQuote
-- and friends only ever persisted address+zip), but a quote-link prospect
-- needs them pre-filled at signup same as address/zip/acreage/plan, so the
-- admin-quote path (the only writer of these two columns for now) needs
-- somewhere to put them.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS quote_token TEXT,
  ADD COLUMN IF NOT EXISTS quote_token_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS leads_quote_token_idx ON public.leads (quote_token)
  WHERE quote_token IS NOT NULL;
