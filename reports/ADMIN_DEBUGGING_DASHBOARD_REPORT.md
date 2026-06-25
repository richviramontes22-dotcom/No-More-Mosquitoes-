# Admin Debugging Dashboard Report
**Date:** 2026-06-02
**Route:** `/admin/debug`
**API:** `GET /api/admin/debug/system-status`
**Files:** `server/routes/adminDebug.ts`, `client/pages/admin/Debug.tsx`

---

## Access Control

- Requires admin JWT (`requireAdmin` middleware)
- In production: additionally requires `ENABLE_ADMIN_DEBUG_PANEL=true` in env (default: false)
- If flag is off in production: API returns HTTP 403 with explanation; page shows error state

---

## What Is Shown

| Category | Data |
|----------|------|
| Environment | `NODE_ENV`, app version |
| Stripe | Mode (test/live), which keys are configured (boolean only), mode mismatch warning |
| Supabase | URL, anon key, service role — configured yes/no only |
| Resend | API key configured yes/no, from email (masked: `ma***@domain.com`) |
| Twilio | Account SID, auth token, from number — configured yes/no only |
| Feature Flags | All 9 flags with current values |
| Operational | Dry-run mode, validation gates, county lookup, Regrid fallback |
| Live Counts | Active subscriptions, active employees, appointments today |
| Request ID | UUID of the debug request (for log tracing) |
| Checkpoint Persistence | Status ("not_enabled") |

---

## What Is NEVER Shown

| Data | Why |
|------|-----|
| Secret key values | Never returned — only `boolean` presence |
| Stripe API keys | Only mode + presence |
| Supabase service role key | Only presence |
| Resend API key | Only presence |
| Auth tokens / JWTs | Not in scope |
| Raw Stripe objects | Not returned |
| Customer PII | No names, emails, addresses |
| Stack traces | Not returned |

---

## Security Architecture

The API endpoint uses `requireAdmin` middleware which:
1. Validates the Bearer JWT via Supabase Auth
2. Checks `profiles.role = 'admin'`
3. Returns 401/403 if either check fails

The response is built with explicit key selection — no wildcard object spread from environment or Stripe. Every field is constructed manually with `!!process.env.FIELD` boolean checks.

---

## Adding to Production

1. Set `ENABLE_ADMIN_DEBUG_PANEL=true` in Netlify Dashboard
2. Navigate to `/admin/debug` while logged in as admin
3. Debug information loads immediately (1-2 DB queries)
4. **Do not leave enabled permanently** — turn off after debugging session

---

## Request ID Tracing

Every debug response includes a `requestId`. Use this to search Netlify function logs:
```
request_id: a1b2c3d4-1234-5678-...
```

This links the debug page load to the specific function execution in the log stream.
