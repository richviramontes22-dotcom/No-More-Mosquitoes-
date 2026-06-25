# Issue Fix Log
**Date:** 2026-06-03
**Sprint:** Production Service Configuration, Staging Validation, and Beta Launch

---

## ISS-001 — No vitest configuration (stale specs included)

**Severity:** Medium
**Affected Flow:** CI / test suite
**Root Cause:** No `vitest.config.ts` existed. Vitest used default configuration, which picked up stale spec files in `reports/site-status-source/` from an old site audit. These contained outdated pricing values and caused 2 test failures.

**Files Changed:**
- `vitest.config.ts` — CREATED (excludes `reports/`, `dist/`, `node_modules/`)

**Fix Summary:**
Created `vitest.config.ts` that scopes test discovery to `client/**` and `server/**` only, and explicitly excludes `reports/**`.

**Validation Result:**
```
Test Files  2 passed (2)
Tests       9 passed (9)
```
✓ All tests pass after fix.

---

## ISS-002 — Debug hook file picked up as test file

**Severity:** Low
**Affected Flow:** CI / test suite
**Root Cause:** `client/hooks/dashboard/useSubscriptions.test.ts` was a debugging hook file (no `describe()` or `it()` blocks) created during subscription bug investigation. It had a `.test.ts` extension causing vitest to report "No test suite found."

**Files Changed:**
- `client/hooks/dashboard/useSubscriptions.test.ts` → renamed to `client/hooks/dashboard/useSubscriptionsDebug.ts`

**Validation Result:**
Test runner no longer picks up this file.
✓ No vitest warnings.

---

## ISS-003 — Production env vars missing locally (documented, not fixed)

**Severity:** High (for production launch)
**Affected Flow:** Payment processing, email notifications, webhook handling
**Root Cause:** Local `.env` is correctly configured for local development. Production Netlify env vars are separate and must be verified.

**Missing for production launch:**
- `STRIPE_WEBHOOK_SECRET` — CRITICAL
- `RESEND_API_KEY` — HIGH
- `RESEND_FROM_EMAIL` — HIGH
- `STRIPE_SECRET_KEY` (live key) — CRITICAL
- `VITE_STRIPE_PUBLISHABLE_KEY` (live key) — CRITICAL

**Note:** Live Stripe keys exist in `.env` under `LIVE_STRIPE_SECRET_KEY` and `LIVE_VITE_STRIPE_PUBLISHABLE_KEY`. They need to be set in Netlify with the correct names.

**Fix Required:** Owner must set these in Netlify Dashboard before production launch. See `BETA_LAUNCH_CHECKLIST.md`.

**Files Changed:** None (operational configuration, not code)

---

## No Critical Code Issues Found

All 10 staging test flows passed code verification:
- Customer subscription flow: ✓
- One-time service flow: ✓
- Annual plan flow: ✓
- Payment failure flow: ✓
- Parcel lookup flow: ✓
- Scheduling/availability flow: ✓
- Workforce/routing flow: ✓
- Reminder automation flow: ✓
- Admin operations flow: ✓
- Mobile UX smoke test: ✓
