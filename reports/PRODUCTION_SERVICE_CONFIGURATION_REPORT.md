# Production Service Configuration Report
**Date:** 2026-06-03
**Source:** `.env` file audit + code analysis

> ⚠ This report was generated from the local `.env` file. Production (Netlify) environment variables are configured separately and must be verified independently.

---

## Critical Variables

| Variable | Local Status | Production Status | Action Required |
|----------|-------------|-------------------|----------------|
| `VITE_SUPABASE_URL` | ✓ SET | Must verify in Netlify | None if set |
| `VITE_SUPABASE_ANON_KEY` | ✓ SET | Must verify in Netlify | None if set |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ SET | Must verify in Netlify | None if set |
| `STRIPE_SECRET_KEY` | ✓ `sk_test_...` (local dev) | Must be `sk_live_...` in Netlify | **Set live key in Netlify** |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ✓ `pk_test_...` (local dev) | Must be `pk_live_...` in Netlify | **Set live key in Netlify** |
| `STRIPE_WEBHOOK_SECRET` | ❌ NOT SET | Must verify in Netlify | **Critical — set before launch** |
| `APP_BASE_URL` | ✓ `https://nomoremosquitoes.us` | Must verify in Netlify | None |
| `RESEND_API_KEY` | ❌ NOT SET | Must set in Netlify | **High — emails won't send without it** |
| `RESEND_FROM_EMAIL` | ❌ NOT SET | Must set in Netlify | **High** |
| `OWNER_EMAIL` | ❌ NOT SET | Must set in Netlify | Medium — admin alerts won't deliver |

---

## Available But Not Active (Local)

The `.env` file contains live Stripe keys under different names:
- `LIVE_STRIPE_SECRET_KEY=sk_live_...` — present but not named correctly
- `LIVE_VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...` — present but not named correctly

**Action:** In Netlify, set these as `STRIPE_SECRET_KEY` and `VITE_STRIPE_PUBLISHABLE_KEY`.

---

## Operational Feature Flags

| Flag | Local Value | Recommended Production |
|------|-------------|----------------------|
| `REMINDER_DRY_RUN` | Not set (defaults `false`) | `false` — correct for production |
| `ENABLE_REMINDER_EMAILS` | Not set (defaults `true`) | `true` — correct |
| `ENABLE_REGRID_FALLBACK` | Not set (defaults `false`) | `false` — correct, cost control |
| `ENABLE_WORKFORCE_VALIDATION` | Not set (defaults `true`) | `true` — correct |
| `ENABLE_ROUTE_PUBLISH_GATE` | Not set (defaults `true`) | `true` — correct |
| `ENABLE_ADMIN_DEBUG_PANEL` | Not set (defaults `false`) | `false` — correct for production |
| `ENABLE_VERBOSE_CHECKPOINTS` | Not set (defaults `false`) | `false` — correct |
| `ENABLE_SENTRY` | Not set (defaults off) | `true` when Sentry configured |

---

## Other Configured Variables

| Variable | Status | Notes |
|----------|--------|-------|
| `REGRID_API_KEY` | ✓ SET locally | Regrid fallback disabled by flag — key available if ever needed |
| `TWILIO_ACCOUNT_SID` | ✓ SET (test SID) | Both test and live SIDs present |
| `TWILIO_AUTH_TOKEN` | ✓ SET (test token) | NullSmsProvider used when `TWILIO_FROM_NUMBER` is empty |
| `TWILIO_FROM_NUMBER` | ❌ EMPTY | SMS disabled — acceptable for beta |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Not in .env | Places Autocomplete works via the key in the API; check if needed |

---

## Production Netlify Checklist (Action Items)

1. ✅ Verify `VITE_SUPABASE_URL` is set
2. ✅ Verify `VITE_SUPABASE_ANON_KEY` is set
3. ✅ Verify `SUPABASE_SERVICE_ROLE_KEY` is set
4. 🔴 Set `STRIPE_SECRET_KEY=sk_live_...` (copy from `LIVE_STRIPE_SECRET_KEY` in .env)
5. 🔴 Set `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...`
6. 🔴 Set `STRIPE_WEBHOOK_SECRET` (from Stripe Dashboard → Webhooks)
7. 🔴 Set `RESEND_API_KEY`
8. 🔴 Set `RESEND_FROM_EMAIL=No More Mosquitoes <hello@nomoremosquitoes.us>`
9. 🟡 Set `OWNER_EMAIL` for admin alerts
10. 🟡 Set `APP_BASE_URL=https://nomoremosquitoes.us`
