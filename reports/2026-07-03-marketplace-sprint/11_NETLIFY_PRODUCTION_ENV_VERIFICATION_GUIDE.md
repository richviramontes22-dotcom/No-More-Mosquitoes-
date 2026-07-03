# 11 — Netlify Production Environment Verification Guide

**Date:** 2026-07-03

---

## How to Verify

Go to: **Netlify Dashboard → Site → Site configuration → Environment variables**  
(Do NOT paste values anywhere — verify names only)

---

## Required Before Real Launch

All of the following must be present in Netlify production environment:

| Variable | Purpose | Required |
|---|---|---|
| `APP_BASE_URL` | Must be `https://nomoremosquitoes.us` — used for Stripe redirect URLs, email links, QR codes | ✅ Critical |
| `VITE_SUPABASE_URL` | Supabase project URL (browser-exposed) | ✅ Critical |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (browser-exposed) | ✅ Critical |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only — bypasses RLS) | ✅ Critical |
| `STRIPE_SECRET_KEY` | Must be `sk_live_...` for production | ✅ Critical |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Must be `pk_live_...` for production | ✅ Critical |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification key | ✅ Critical |
| `RESEND_API_KEY` | Email delivery | ✅ Required |
| `RESEND_FROM_EMAIL` | From address for customer emails (e.g. `hello@nomoremosquitoes.us`) | ✅ Required |
| `SUPPORT_PHONE` | Shown in SMS templates and customer-facing messages | ✅ Required |
| `OWNER_EMAIL` | Admin alert recipient | ✅ Required |
| `ADMIN_ALERT_EMAILS` | Comma-separated fallback alert list if OWNER_EMAIL missing | ✅ Required |
| `GOOGLE_MAPS_SERVER_KEY` | Server-side geocoding (parcel quote) | ✅ Required |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Browser-side address autocomplete | ✅ Required |
| `REGRID_API_KEY` | Legacy GIS fallback (disabled by default) | Optional |

---

## Optional: SMS When Ready

Add these only when you are ready to activate SMS (Telnyx or other provider):

| Variable | Purpose |
|---|---|
| `SMS_PROVIDER` | e.g. `telnyx` |
| `SMS_API_KEY` | Provider API key |
| `SMS_FROM_NUMBER` | Sending number (E.164 format) |
| `SMS_MESSAGING_PROFILE_ID` | Telnyx profile ID if applicable |

Until these are set, the null provider is used — no SMS is sent, no errors are thrown.

---

## MUST NOT Be in Netlify Production

| Variable | Reason |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Management API token — belongs in CI/CD secrets or developer shell profile only |
| `LIVE_STRIPE_SECRET_KEY` | Dead variable (was an old naming convention) — if present, remove it |
| `LIVE_VITE_STRIPE_PUBLISHABLE_KEY` | Same — remove if present |
| `TWILIO_TEST_ACCOUNT_SID` | Twilio is not used — remove if present |
| `TWILIO_TEST_AUTH_TOKEN` | Same — remove if present |
| Any `.env` file secrets not listed above | |

---

## Stripe Live/Test Guard

The server runs `assertStripeKeyNotTestInProduction()` at startup. If `STRIPE_SECRET_KEY` starts with `sk_test_` while `NODE_ENV=production`, it:
- Logs a console warning
- Shows a warning on the `/admin/debug` page and `/api/health` endpoint
- Does NOT throw — customers can still use the site

**Before real launch:** Ensure `STRIPE_SECRET_KEY` is `sk_live_*` and `VITE_STRIPE_PUBLISHABLE_KEY` is `pk_live_*` in Netlify.

---

## Verification Checklist

```
□ APP_BASE_URL = https://nomoremosquitoes.us (not localhost, not http)
□ VITE_SUPABASE_URL present
□ VITE_SUPABASE_ANON_KEY present
□ SUPABASE_SERVICE_ROLE_KEY present
□ STRIPE_SECRET_KEY starts with sk_live_
□ VITE_STRIPE_PUBLISHABLE_KEY starts with pk_live_
□ STRIPE_WEBHOOK_SECRET present
□ RESEND_API_KEY present
□ RESEND_FROM_EMAIL present and matches sending domain
□ SUPPORT_PHONE present (format: +1XXXXXXXXXX)
□ OWNER_EMAIL present
□ ADMIN_ALERT_EMAILS present
□ GOOGLE_MAPS_SERVER_KEY present
□ VITE_GOOGLE_MAPS_BROWSER_KEY present
□ SUPABASE_ACCESS_TOKEN NOT present
□ LIVE_STRIPE_SECRET_KEY NOT present
□ TWILIO_* vars NOT present
```

---

## Status

Manual verification by site owner required. This guide provides the complete checklist. No env values were read or printed during this audit.
