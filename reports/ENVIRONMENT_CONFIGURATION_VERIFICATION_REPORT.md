# Phase 3 — Environment Configuration Verification Report
**Date:** 2026-05-30
**Sprint:** Production Verification & Operational Readiness Sprint

---

## Summary

The `.env` file was read to confirm key presence (SET vs NOT SET). No values were logged. The provider abstraction layer was verified to handle missing credentials gracefully via NullProviders.

---

## Environment Variable Status

### Required Variables (app crashes or breaks without these)

| Variable | Status | Notes |
|----------|--------|-------|
| `VITE_SUPABASE_URL` | SET | Value present in .env |
| `VITE_SUPABASE_ANON_KEY` | SET | Value present in .env |
| `SUPABASE_SERVICE_ROLE_KEY` | SET | Value present in .env |
| `STRIPE_SECRET_KEY` | SET | TEST key (`sk_test_`) — must be replaced with `sk_live_` for production |
| `VITE_STRIPE_PUBLISHABLE_KEY` | SET | TEST key (`pk_test_`) — must be replaced with `pk_live_` for production |
| `APP_BASE_URL` | SET | `https://nomoremosquitoes.us` |
| `STRIPE_WEBHOOK_SECRET` | NOT SET | CRITICAL: All Stripe webhooks will return 500 without this |
| `RESEND_API_KEY` | NOT SET | Emails will use NullProvider (log-only) |
| `RESEND_FROM_EMAIL` | NOT SET | Uses default `hello@nomoremosquitoes.us` via getFromEmail() fallback |
| `REMINDER_DRY_RUN` | NOT SET | Defaults to "false" (production mode) — safe |

### Optional Variables (features degrade gracefully without these)

| Variable | Status | Impact If Missing |
|----------|--------|------------------|
| `TWILIO_ACCOUNT_SID` | SET (test SID) | SMS uses NullSmsProvider if `TWILIO_FROM_NUMBER` not set |
| `TWILIO_AUTH_TOKEN` | SET (test token) | SMS uses NullSmsProvider if `TWILIO_FROM_NUMBER` not set |
| `TWILIO_FROM_NUMBER` | NOT SET | NullSmsProvider used — SMS logged to console only |
| `OWNER_EMAIL` | NOT SET | Admin alert emails not sent; alerts still logged to DB |
| `OWNER_PHONE` | NOT SET | Admin alert SMS not sent |
| `ADMIN_ALERT_EMAILS` | NOT SET | No fallback admin emails |
| `COMPANY_ADDRESS` | NOT SET | Omitted from email footer |
| `SUPPORT_EMAIL` | NOT SET | Falls back to `support@nomoremosquitoes.us` in code |
| `SUPPORT_PHONE` | NOT SET | Falls back to `(949) 555-0100` in SMS webhook |
| `GOOGLE_MAPS_SERVER_KEY` | NOT SET | Backend geocoding disabled |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | NOT SET | Frontend Places Autocomplete disabled |
| `REGRID_API_KEY` | SET | Legacy fallback (disabled by `REGRID_FALLBACK_ENABLED=false`) |
| `STRIPE_AUTO_TAX` | NOT SET | Defaults to false (no automatic tax) — correct for current state |
| `VITE_CRISP_WEBSITE_ID` | NOT SET | Crisp live chat widget disabled |
| `PARCEL_CACHE_ENABLED` | NOT SET | Defaults to true per .env.example |

---

## Provider Fallback Verification

### Email Provider (`server/services/notifications/providers/index.ts`)

**Code read at:** `getEmailProvider()` function, lines 109-113

```typescript
export function getEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) {
    return new ResendEmailProvider();
  }
  return new NullEmailProvider();
}
```

**VERIFIED:** When `RESEND_API_KEY` is NOT SET, `NullEmailProvider` is returned. `NullEmailProvider.send()` logs intent to console and returns void without error. App does NOT crash.

### SMS Provider (`server/services/notifications/providers/index.ts`)

**Code read at:** `getSmsProvider()` function, lines 120-128

```typescript
export function getSmsProvider(): SmsProvider {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_NUMBER;
  if (sid && token && from) {
    return new TwilioSmsProvider(sid, token);
  }
  return new NullSmsProvider();
}
```

**VERIFIED:** All three Twilio vars must be SET for real SMS. Since `TWILIO_FROM_NUMBER` is NOT SET, `NullSmsProvider` is returned. `NullSmsProvider.send()` logs intent to console. App does NOT crash.

**Current state:** TWILIO_FROM_NUMBER is blank in .env → NullSmsProvider active → SMS is logged only.

### Admin Alert Emails

**Code read at:** `adminNotificationService.ts` `resolveAdminRecipients()` function, lines 48-64

```typescript
function resolveAdminRecipients(): AdminRecipients {
  const ownerEmail  = process.env.OWNER_EMAIL;
  const adminEmails = process.env.ADMIN_ALERT_EMAILS;
  const emails: string[] = [];
  if (ownerEmail) {
    emails.push(ownerEmail);
  } else if (adminEmails) {
    adminEmails.split(",").map(...).forEach(...);
  }
  ...
}
```

**VERIFIED:** When `OWNER_EMAIL` is NOT SET and `ADMIN_ALERT_EMAILS` is NOT SET, `emails` array is empty. `sendAdminEmail()` checks `if (!emails.length) return false;` — no email sent, no crash.

**Current state:** No admin alert emails will be sent. Alerts are still inserted to `admin_alerts` table in DB (insertAdminAlert still called).

### Stripe Webhook (CRITICAL ISSUE)

**Code read at:** `webhooksStripe.ts` lines 40-46:

```typescript
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = getStripeClient();

if (!stripe || !webhookSecret) {
  console.error("[Stripe Webhook] Missing Stripe client or webhook secret");
  return res.status(500).json({ error: "Server configuration missing." });
}
```

**CRITICAL DEFECT:** `STRIPE_WEBHOOK_SECRET` is NOT SET in `.env`. When webhooks arrive, the handler returns HTTP 500. Stripe will interpret 500 as a delivery failure and retry up to 3 days. This means ALL Stripe events (invoice.paid, subscription.deleted, checkout.completed, etc.) will fail silently until this var is set.

**Impact:** CRITICAL — payment webhooks, subscription lifecycle, appointment creation from checkout — all blocked.

---

## Supabase Connection Check

`SUPABASE_URL` is not directly in the .env file. The server-side code uses:
- `VITE_SUPABASE_URL` for the Supabase URL (SET)
- `SUPABASE_SERVICE_ROLE_KEY` for service role access (SET)

In `supabaseAdmin.ts` / `supabase.ts`, these values would resolve correctly.

---

## Server Startup Assessment

The server will NOT crash on startup with the current env vars, because:

1. `assertStripeKeyNotTestInProduction()` in `server/lib/stripeMode.ts` — this checks `NODE_ENV === 'production'` before failing on test keys. In development mode, test keys are allowed.
2. All notification providers fall back gracefully to NullProvider
3. Missing `STRIPE_WEBHOOK_SECRET` only blocks webhook requests, not server startup

---

## Critical Actions Required Before Production Deployment

1. **Set `STRIPE_WEBHOOK_SECRET`** — Without this, ALL Stripe webhooks fail with HTTP 500
2. **Set `STRIPE_SECRET_KEY` to live key** (`sk_live_`) — Required for real payments
3. **Set `VITE_STRIPE_PUBLISHABLE_KEY` to live key** (`pk_live_`) — Required for frontend Stripe Elements
4. **Set `RESEND_API_KEY`** — Without this, all emails are silently dropped (NullProvider)
5. **Set `RESEND_FROM_EMAIL`** — Required for correct sender address
6. **Set `TWILIO_FROM_NUMBER`** — Without this, all SMS is NullProvider (log only)
7. **Set `OWNER_EMAIL`** — Without this, admin alert emails are not sent (alerts still stored in DB)

---

## Assessment

**CONDITIONAL PASS** for local/development use. **NO-GO for production** until:
- `STRIPE_WEBHOOK_SECRET` set (CRITICAL — blocks all payment processing via webhooks)
- Stripe keys switched to live (`sk_live_`, `pk_live_`)
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` set in Netlify production env
- `TWILIO_FROM_NUMBER` set for SMS delivery
