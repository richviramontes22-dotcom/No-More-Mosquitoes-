# Final Beta Go / No-Go Report — Production Sprint Final
**Date:** 2026-06-03 (supersedes prior 2026-05-28 report)
**Based on:** Final Scheduling Verification Sprint + End-to-End Production Simulation

---

## Readiness Percentage

**87% ready for beta launch**

The core payment, scheduling, assignment, and notification flows are correctly implemented and verified. The remaining 13% represents infrastructure configuration steps (Supabase setup, Stripe webhook registration, env vars) and two medium-severity RLS/trigger concerns that must be verified before users touch the system.

---

## Remaining Launch Blockers

### BLOCKER 1 — Supabase Profile Row Trigger Must Be Confirmed Deployed
**Why it blocks:** If the `auth.users` → `profiles` INSERT trigger is not deployed, every new user signup will have no profile row. This breaks billing (no stripe_customer_id), notifications (no email on record), and onboarding flows. The trigger is not visible in any application code file — it must exist as a Supabase DB migration.

**Resolution:** Confirm the trigger exists in the Supabase project dashboard under Database → Triggers. If missing, deploy the trigger SQL before accepting any real users.

**Estimated effort:** 30 minutes (SQL trigger + migration file).

---

### BLOCKER 2 — Admin Appointments RLS Must Be Verified
**Why it blocks:** The admin appointments page reads from `appointments` using the Supabase anon key client-side. If RLS does not allow the admin role to read all rows, admins will see zero appointments. This would make operations management impossible.

**Resolution:** In Supabase → Authentication → Policies → `appointments` table, confirm there is a policy:
```sql
CREATE POLICY "Admins can read all appointments"
ON appointments FOR SELECT
USING (auth.jwt() ->> 'role' = 'admin');
```
If missing, add it. Alternatively, migrate admin appointment reads to the server API using `supabaseAdmin` with `requireAdmin` middleware.

**Estimated effort:** 15–30 minutes.

---

## Beta-Safe Limitations (Will Not Block Launch)

| # | Limitation | Risk Level | Notes |
|---|-----------|-----------|-------|
| 1 | Recurring generator uses global business hours only | Low | Single-area MVP has no area-specific hour overrides |
| 2 | Blackout date scope not filtered in recurring generator | Low | Conservative (over-blocks), never creates appointment on blacked-out day |
| 3 | No anchor appointment = recurring gen skips new subscriptions | Low | Expected behavior; first appointment set manually per workflow |
| 4 | Admin appointment page uses anon key for reads | Medium | Blocked by BLOCKER 2 above; must be verified |
| 5 | Reminder skips legacy appointments without `window_label` | Low | All new appointments (post-Phase 1) have window_label |
| 6 | Annual plan renewal is manual (no auto-renew) | Low | By design; team reaches out at `current_period_end` |
| 7 | `SLOT_SEARCH_WINDOW = 14 days` — no-slot ticket if all windows full | Low | Very unlikely in beta with 1–2 employees and low volume |
| 8 | Marketplace `create-checkout-session` has debug console.log statements | Very Low | Not a functional issue; cosmetic cleanup for GA |
| 9 | Supabase profile trigger not in app code (infrastructure concern) | Medium | Blocked by BLOCKER 1 above |

---

## Required Environment Variables (Complete Production List)

### Critical (App will not start / payment will fail without these)

| Variable | Purpose | Notes |
|----------|---------|-------|
| `STRIPE_SECRET_KEY` | Stripe API key | Must be `sk_live_...` in production |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client-side Stripe | Must be `pk_live_...` in production |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | From Stripe Dashboard → Webhooks |
| `VITE_SUPABASE_URL` | Supabase project URL | From Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase public key | From Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin bypass | From Supabase Dashboard → Settings → API (secret) |
| `APP_BASE_URL` | Stripe redirect URLs | e.g., `https://nomoremosquitoes.us` — required to avoid localhost redirects in production |

### Required for Notifications

| Variable | Purpose | Notes |
|----------|---------|-------|
| `RESEND_API_KEY` | Transactional email | From resend.com; must be `re_live_...` or valid key |
| `RESEND_FROM_EMAIL` | From address on all emails | e.g., `No More Mosquitoes <hello@nomoremosquitoes.us>` — domain must be verified in Resend |

### Required for SMS (Optional but Expected for Beta)

| Variable | Purpose | Notes |
|----------|---------|-------|
| `TWILIO_ACCOUNT_SID` | Twilio SMS | From Twilio console |
| `TWILIO_AUTH_TOKEN` | Twilio auth | From Twilio console |
| `TWILIO_FROM_NUMBER` | SMS sender number | E.164 format: +1XXXXXXXXXX |

### Required for Acreage Quotes

| Variable | Purpose | Notes |
|----------|---------|-------|
| `GOOGLE_MAPS_SERVER_KEY` | Server-side geocoding | Google Cloud → Maps Platform API key (server-restricted) |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Frontend Places Autocomplete | Browser-restricted Google key |

### Optional / Configurable

| Variable | Default | Purpose |
|----------|---------|---------|
| `STRIPE_AUTO_TAX` | `false` | Enable Stripe Tax; requires Stripe Tax configured in Dashboard |
| `APPOINTMENT_GEN_DRY_RUN` | `false` | Set `true` to log without writing appointments |
| `REMINDER_DRY_RUN` | `false` | Set `true` to log reminders without sending |
| `REGRID_FALLBACK_ENABLED` | `false` | Legacy parcel lookup; disabled by default |
| `REGRID_API_KEY` | — | Only needed if `REGRID_FALLBACK_ENABLED=true` |
| `PARCEL_CACHE_ENABLED` | `true` | Cache parcel lookups in DB |
| `REDIS_URL` | — | Redis hot cache (optional) |
| `VITE_CRISP_WEBSITE_ID` | — | Crisp chat widget |
| `NODE_ENV` | — | Must be `production` on Netlify; this enables the Stripe key guard |

---

## Required Manual Setup Steps (Pre-Launch Checklist)

### Supabase

- [ ] **Deploy all DB migrations** in `db/migrations/` in order (phase1, phase2, phase3a, stripe_dual_mode)
- [ ] **Verify profile creation trigger** exists on `auth.users` INSERT → creates `profiles` row
- [ ] **Verify RLS policies** on `appointments`, `subscriptions`, `profiles`, `properties` allow admin role full read access
- [ ] **Create Supabase Storage bucket** `job-media` with appropriate public/RLS policies for employee uploads
- [ ] **Confirm service_role key** is set in `SUPABASE_SERVICE_ROLE_KEY` env var

### Stripe

- [ ] **Set `STRIPE_SECRET_KEY` to live key** (`sk_live_...`) in Netlify environment variables
- [ ] **Set `VITE_STRIPE_PUBLISHABLE_KEY` to live publishable key** (`pk_live_...`)
- [ ] **Register Stripe Webhook endpoint**: `https://nomoremosquitoes.us/api/webhooks/stripe`
- [ ] **Add webhook events**: `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- [ ] **Copy webhook signing secret** to `STRIPE_WEBHOOK_SECRET` env var
- [ ] **Verify live prices** exist in Stripe for all service tiers (or verify inline price_data fallback works)
- [ ] **Create Stripe Billing Portal** configuration in Dashboard (for customer self-service)

### Netlify

- [ ] **Set all production env vars** listed above in Netlify → Site Settings → Environment Variables
- [ ] **Verify `NODE_ENV=production`** is set (Netlify sets this by default for production builds)
- [ ] **Verify scheduled functions** are enabled: `send-reminders` (7 AM UTC) and `generate-appointments` (8 AM UTC)
- [ ] **Set `APP_BASE_URL=https://nomoremosquitoes.us`** to prevent localhost Stripe redirect URLs

### Resend

- [ ] **Verify sending domain** `nomoremosquitoes.us` in Resend Dashboard → Domains
- [ ] **Confirm DKIM/SPF/DMARC records** are configured on the domain DNS
- [ ] **Confirm `RESEND_FROM_EMAIL`** uses the verified domain

### Operational

- [ ] **Create at least one employee** record in `employees` table with `status = "active"` before going live (otherwise capacity = 1 for all slots, which is the correct fallback behavior, but explicit is better)
- [ ] **Configure business hours** in Admin → Business Hours for at least one operational day/window
- [ ] **Seed initial service areas** if geographic filtering will be used
- [ ] **Run a test booking end-to-end** with a test customer account before removing test mode

---

## Final Verdict: **CONDITIONAL GO**

The codebase is functionally complete and all 9 previously tracked fixes are verified. The scheduling, payment, employee, and notification systems work end-to-end as designed.

**Beta launch is approved provided the following two items are resolved first:**

1. **Confirm and deploy the Supabase profile creation trigger.** Without it, new users have no profile row and billing breaks immediately on first purchase.

2. **Confirm or fix admin appointments RLS policy.** Without the correct policy, the operations team cannot see any appointments and cannot run the business.

Both items are infrastructure/configuration tasks, not code changes. Each takes under an hour to resolve.

---

## What to Monitor in First Week of Beta

| Signal | What to Watch | Alert Threshold |
|--------|--------------|-----------------|
| Netlify function logs | `generate-appointments` run results | `failed > 0` or `noSlotFound > 0` |
| Netlify function logs | `send-reminders` run results | `failed > 0` |
| Stripe Dashboard | Webhook delivery success rate | Any 4xx/5xx from webhook endpoint |
| Stripe Dashboard | `payment_intent.succeeded` vs `checkout.session.completed` ratio | Should be 1:1 for subscription checkouts |
| Supabase Dashboard | `appointments` table row count | Should grow after each completed booking |
| Supabase Dashboard | `subscriptions` table with `status = "active"` | Should match Stripe active subscription count |
| Server logs | `[FATAL] Stripe test key used in production` | If seen, immediately halt and fix env var |
| Server logs | `[Billing] Stripe key mode: TEST | NODE_ENV: production` | Warning level — investigate |
| Resend Dashboard | Bounce rate on confirmation/reminder emails | Bounces > 5% suggest deliverability issue |
| Admin Appointments page | Appointment list populates with data | If empty, RLS policy issue (BLOCKER 2) |
