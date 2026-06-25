# Environment Variable Audit
**Date:** 2026-06-03
**Method:** grep across entire repository + .env file direct inspection

---

## STRIPE_SECRET_KEY

| Attribute | Value |
|-----------|-------|
| Used By | billingStripe.ts, webhooksStripe.ts, adminStripe.ts, stripeMode.ts, marketplaceStripe.ts |
| Required? | YES — app crashes with FATAL error if missing in production |
| Fallback? | `STRIPE_API_KEY` then `STRIPE_SECRET` |
| Local .env | `sk_test_51T8zHI0z...` ✅ |
| Production Netlify | Must be `sk_live_...` ⚠ (live key available in .env as `LIVE_STRIPE_SECRET_KEY`) |
| Mismatch? | Variable name mismatch: live key stored as `LIVE_STRIPE_SECRET_KEY` not `STRIPE_SECRET_KEY` |

---

## STRIPE_WEBHOOK_SECRET

| Attribute | Value |
|-----------|-------|
| Used By | webhooksStripe.ts line 40 |
| Required? | YES — all webhooks return 500 if missing |
| Fallback? | None |
| Local .env before sprint | NOT SET ❌ |
| Local .env after sprint | SET to CLI test secret ✅ |
| Production Netlify | Must be set to Stripe Dashboard webhook signing secret |
| Mismatch? | Was missing locally; must be set in Netlify for production |

---

## VITE_STRIPE_PUBLISHABLE_KEY

| Attribute | Value |
|-----------|-------|
| Used By | client/lib/stripe.ts line 5 |
| Required? | YES — PaymentElement won't load without it |
| Fallback? | Falls back to empty string → Stripe loads but fails to initialize |
| Local .env | `pk_test_51T8zHI0z...` ✅ |
| Production Netlify | Must be `pk_live_...` ⚠ (live key in .env as `LIVE_VITE_STRIPE_PUBLISHABLE_KEY`) |
| Mismatch? | Same naming mismatch as above |

---

## RESEND_API_KEY

| Attribute | Value |
|-----------|-------|
| Used By | server/services/notifications/resendClient.ts line 6 |
| Required? | NO — falls back to NullEmailProvider (logs intent, no actual send) |
| Fallback? | NullEmailProvider — safe, no crash |
| Local .env | NOT SET |
| Production behavior without it | All emails silently dropped (NullProvider logs them) |
| Mismatch? | Not a mismatch — but emails won't send without it |

---

## RESEND_FROM_EMAIL

| Attribute | Value |
|-----------|-------|
| Used By | server/services/notifications/resendClient.ts line 12 |
| Required? | NO |
| Fallback? | `"No More Mosquitoes <hello@nomoremosquitoes.us>"` hardcoded default |
| Local .env | NOT SET |
| Production behavior without it | Uses hardcoded default — acceptable |
| Mismatch? | None — default is correct |

---

## APP_BASE_URL

| Attribute | Value |
|-----------|-------|
| Used By | billingStripe.ts (Stripe redirect URLs), employeeAssignments.ts, schedule.ts, unsubscribe.ts |
| Required? | YES for Stripe redirect after 3DS/checkout |
| Fallback? | `"https://nomoremosquitoes.us"` hardcoded in several places |
| Local .env | `https://nomoremosquitoes.us` ✅ |
| Production Netlify | Should be set to confirm it's used |
| Mismatch? | None |

---

## Key Discovery: Variable Name Mismatch in .env

The `.env` file contains **live Stripe keys under wrong variable names**:

```
LIVE_STRIPE_SECRET_KEY=sk_live_51T8zGo1GVLFt2OB8...    ← WRONG NAME
LIVE_VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51T8zGo1...    ← WRONG NAME
```

The app reads:
```
STRIPE_SECRET_KEY=...
VITE_STRIPE_PUBLISHABLE_KEY=...
```

**This means the live keys will NOT be picked up locally.** For production Netlify, the keys must be set with the correct names: `STRIPE_SECRET_KEY` and `VITE_STRIPE_PUBLISHABLE_KEY`.

---

## Full Variable Status Summary

| Variable | Local .env | Production Netlify | Required |
|----------|-----------|-------------------|---------|
| `VITE_SUPABASE_URL` | ✅ SET | Must verify | Critical |
| `VITE_SUPABASE_ANON_KEY` | ✅ SET | Must verify | Critical |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ SET | Must verify | Critical |
| `STRIPE_SECRET_KEY` | ✅ test key | Must set live key | Critical |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ✅ test key | Must set live key | Critical |
| `STRIPE_WEBHOOK_SECRET` | ✅ CLI test secret | Must set Dashboard secret | Critical |
| `APP_BASE_URL` | ✅ SET | Must verify | Critical |
| `RESEND_API_KEY` | ❌ NOT SET | Must set | High |
| `RESEND_FROM_EMAIL` | ❌ NOT SET | Optional (has default) | Low |
| `OWNER_EMAIL` | ❌ NOT SET | Should set | Medium |
| `REGRID_API_KEY` | ✅ SET | Not needed (flag off) | N/A |
| `TWILIO_ACCOUNT_SID` | ✅ SET (test) | Optional | Low |
| `TWILIO_FROM_NUMBER` | ❌ EMPTY | Optional | Low |
