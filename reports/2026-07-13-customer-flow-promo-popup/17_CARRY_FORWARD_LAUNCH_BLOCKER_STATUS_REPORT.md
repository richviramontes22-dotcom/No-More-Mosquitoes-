# Report 17 — Carry-Forward Launch Blocker Status

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 17 (Close-Out)  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Launch Blockers from Previous Sprint (2026-07-03)

Two manual blockers were identified in the launch-signoff sprint (Report 15:
`reports/2026-07-03-launch-signoff/15_FINAL_GO_NO_GO_DECISION_REPORT.md`):

### Blocker 1: Cross-Customer RLS Isolation Test

**Status: OPEN**

**What it requires:**  
A live Supabase test confirming that a session token for Customer A cannot read or write
Customer B's rows in `profiles`, `properties`, `appointments`, `service_plans`, `lead_activities`,
and `leads` — via direct Supabase client calls with Customer A's JWT.

**Impact of this sprint:** None. No RLS policies were modified. The `promotional_popups` table
has its own RLS (public read of active/current rows only; service role full access). The
existing customer-data table RLS policies are unchanged.

**Estimated effort:** 30–60 minutes with live Supabase access.

---

### Blocker 2: Netlify Environment Verification

**Status: OPEN**

**What it requires:**  
Verify in the Netlify dashboard that all required environment variables (see `.env.example`)
are set correctly in the production environment:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (live, not test), `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `TWILIO_*` (or null provider)
- `GOOGLE_MAPS_API_KEY` (server), `VITE_GOOGLE_MAPS_KEY` (browser)
- `OWNER_ALERT_EMAIL`, `ADMIN_ALERT_EMAIL`

**New env var added this sprint:** None. `promotional_popups` uses existing Supabase
credentials; no new integrations.

**Estimated effort:** 15–30 minutes in the Netlify dashboard.

---

## New Pending Item from This Sprint

### Pending: Apply DB Migration

**File:** `db/migrations/2026-07-13_create_promotional_popups.sql`  
**Applies to:** Supabase production (and dev, if using a separate project)  
**Method:** Supabase SQL Editor → paste and run  
**Blocking:** Promotional popup admin UI will load but show an error on first data fetch
until the table exists. API endpoint will return 500.  
**Estimated effort:** 5 minutes.

---

## Summary Table

| Item | Type | Sprint | Status |
|------|------|--------|--------|
| Cross-customer RLS isolation test | Manual QA | Launch signoff | OPEN |
| Netlify env verification | Manual ops | Launch signoff | OPEN |
| Apply `2026-07-13_create_promotional_popups.sql` | DB migration | This sprint | OPEN |
| All code changes | Dev | This sprint | COMPLETE |
| Typecheck / tests / build | Validation | This sprint | PASSED |

---

## Not Carry-Forward (Resolved in This Sprint)

- Appointment slot capacity exposure — RESOLVED
- Language selector UI — RESOLVED
- Hero phone number hardcoding — RESOLVED
- Promotional popup system (DB + API + admin UI + customer display) — SHIPPED
