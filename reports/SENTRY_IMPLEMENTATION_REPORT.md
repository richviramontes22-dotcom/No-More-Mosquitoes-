# Sentry Implementation Report
**Date:** 2026-06-02

---

## Status: IMPLEMENTED (packages optional)

The Sentry wrappers are active. `captureException()` is now wired into all critical failure paths. The build passes without `@sentry/node` or `@sentry/react` installed.

---

## Server-Side Wiring

| Location | Event Captured | Context |
|----------|---------------|---------|
| `billingStripe.ts` confirm-booking catch | `billing.confirm_booking.failed` | `requestId`, `flow: confirm_booking` |
| `parcelLookupService.ts` county adapter catch | `parcel.lookup.county_failed` | `requestId`, `county` |
| `reminderScheduler.ts` batch catch | `reminder.batch.crashed` | `notificationType` |

All use `captureException(err, { requestId, tags: { flow: "..." } })`.

---

## Client-Side Wiring

| Location | How |
|----------|-----|
| `App.tsx` | `initSentry()` called at app boot |
| `ErrorBoundary.tsx` | `captureClientException()` in `componentDidCatch` with `errorId` |

---

## To Enable in Production

1. Create a Sentry project at sentry.io
2. Set in Netlify Dashboard → Environment Variables:
   ```
   ENABLE_SENTRY=true
   SENTRY_DSN=https://xxx@oNNN.ingest.sentry.io/NNN
   VITE_ENABLE_SENTRY=true
   VITE_SENTRY_DSN=https://xxx@oNNN.ingest.sentry.io/NNN
   ```
3. Optionally install packages for full SDK features:
   ```bash
   npm install @sentry/node @sentry/react
   ```
4. Deploy. Errors appear in Sentry within minutes.

---

## Security Protections

- `Authorization` header stripped in `beforeSend`
- No API keys, secrets, or tokens in events
- No raw Stripe or Supabase objects
- `requestId` tag enables log correlation
