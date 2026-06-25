# Sentry Integration Plan / Report
**Date:** 2026-06-02

---

## What Was Implemented

### Server-side wrapper (`server/lib/sentry.ts`)
- Initializes `@sentry/node` only when `ENABLE_SENTRY=true` AND `SENTRY_DSN` is set
- Uses `require()` with try/catch — build never fails if `@sentry/node` is absent
- Strips `Authorization` headers before sending to Sentry
- Exports `captureException(err, { requestId, tags })` — always a no-op when Sentry is off
- Exports `captureMessage(message, level)` — always a no-op when off

### Client-side wrapper (`client/lib/sentry.ts`)
- Initializes `@sentry/react` only when `VITE_ENABLE_SENTRY=true` AND `VITE_SENTRY_DSN` is set
- Uses indirect dynamic import (`"@sentry" + "/react"`) — TypeScript never resolves it statically
- Build passes whether or not `@sentry/react` is installed
- Exports `initSentry()` — call in `main.tsx` or `App.tsx`
- Exports `captureClientException(err, context)` — safe no-op when off

---

## What Is Deferred

| Item | Reason |
|------|--------|
| Wiring `captureException` into billing catch blocks | Low risk but adds dependency — deferred to avoid any regression |
| React Error Boundary integration | Need to create ErrorBoundary component — small, safe to add later |
| RequestId tag in Sentry events | Ready to add once captureException is wired |
| Performance tracing | Optional; set `tracesSampleRate=0` to disable |

---

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `ENABLE_SENTRY` | Server | `false` | Must be `"true"` to activate |
| `SENTRY_DSN` | Server | — | From Sentry project settings |
| `VITE_ENABLE_SENTRY` | Client | `false` | Must be `"true"` to activate |
| `VITE_SENTRY_DSN` | Client | — | Can be the same DSN as server |
| `SENTRY_TRACES_SAMPLE_RATE` | Server | `0.1` | 10% performance tracing |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Client | `0.1` | 10% performance tracing |

---

## Deployment Notes

**To enable Sentry in production:**

1. Create a project at sentry.io
2. Copy the DSN (format: `https://xxx@oNNN.ingest.sentry.io/NNN`)
3. In Netlify Dashboard → Environment Variables:
   ```
   ENABLE_SENTRY=true
   SENTRY_DSN=https://xxx@oNNN.ingest.sentry.io/NNN
   VITE_ENABLE_SENTRY=true
   VITE_SENTRY_DSN=https://xxx@oNNN.ingest.sentry.io/NNN
   ```
4. Install packages (optional — wrappers work without them):
   ```bash
   npm install @sentry/node @sentry/react
   ```
5. Deploy. Errors will appear in Sentry dashboard within minutes.

**To disable Sentry:** Set `ENABLE_SENTRY=false` (or remove the var). No restart needed — flags are read at boot time.

---

## Security

- Authorization headers are stripped in `beforeSend`
- No API keys, Stripe objects, or Supabase payloads are included in events
- RequestId is available as a tag to correlate Sentry events with server logs
- PII scrubbing: Sentry has built-in PII detection — enable "Data Scrubbing" in project settings
