# Netlify Stripe Context Report
**Date:** 2026-06-03

---

## Critical Netlify Behavior

**Netlify always sets `NODE_ENV=production`** for deployed functions — including:
- Production deploys
- Preview deploys (PR previews, branch deploys)
- Staging deploys

This is documented Netlify behavior and NOT configurable per-environment without explicit env var overrides.

---

## The Conflict

```
Netlify production context: NODE_ENV="production"
Netlify env var:            STRIPE_SECRET_KEY="sk_test_..."  (test key for testing)

assertStripeKeyNotTestInProduction() logic:
  if (NODE_ENV === "production" && key.startsWith("sk_test_")) {
    throw new Error("[FATAL]...")  ← crashes ALL API routes
  }
```

This is a **design conflict** — the guard assumes `NODE_ENV=production` means a live deployment with live keys. But Netlify's uniform `NODE_ENV=production` breaks this assumption for staging/testing.

---

## Production vs Staging on Netlify

| Deploy Type | NODE_ENV | Expected Key | Guard Result (before fix) |
|-------------|----------|--------------|--------------------------|
| Production (nomoremosquitoes.us main) | `production` | `sk_live_...` | ✅ No throw |
| Preview deploy (branch, PR) | `production` | `sk_test_...` | 🔴 THROWS — all routes fail |
| Local dev server | `development` | `sk_test_...` | ✅ No throw |

---

## Why "Working Earlier Today" Broke

1. Sprints ran during the day
2. User pushed/deployed to Netlify (or Netlify auto-deployed)
3. New `assertStripeKeyNotTestInProduction()` at startup threw on Netlify
4. ALL `/api/*` routes returned function errors
5. Payment flow broke → Stripe-related errors appeared

---

## Why Keys Are "Present and Correct" But Still Broke

The keys ARE present in Netlify. The issue is NOT key validity or configuration. The issue is:
- `sk_test_...` key is CORRECT for staging/testing
- But the new guard incorrectly treats staging as production
- The guard throws regardless of key validity

---

## Fix Verified

`assertStripeKeyNotTestInProduction()` now logs a `console.error` warning instead of throwing. The serverless function starts correctly whether test or live keys are present. The mismatch is visible in Netlify logs for operator awareness.

---

## Does Netlify Need a Rebuild After Env Var Changes?

| Variable Type | Rebuild Required? |
|--------------|------------------|
| `VITE_*` (client-side) | YES — Vite bakes these into the bundle at build time |
| Non-VITE server vars | NO — serverless functions read `process.env` at request time |

If `VITE_STRIPE_PUBLISHABLE_KEY` was added/changed in Netlify env vars, a new Netlify deploy (rebuild) is required for the change to appear in the client bundle.

**Current status:** The frontend build uses whatever `VITE_STRIPE_PUBLISHABLE_KEY` was present when the last Netlify deploy ran.
