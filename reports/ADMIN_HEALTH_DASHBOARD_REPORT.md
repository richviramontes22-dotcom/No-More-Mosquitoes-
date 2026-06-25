# Admin Health Dashboard Report
**Date:** 2026-06-02
**File:** `client/pages/admin/Debug.tsx`
**Route:** `/admin/debug`

---

## What Was Added

The existing `/admin/debug` page was extended with a **Live Health Checks** section that fetches from all 6 health endpoints on page load.

---

## Live Health Cards

| Card | Endpoint | Shows |
|------|----------|-------|
| Database | `/api/health/database` | OK/error + latency in ms |
| Stripe | `/api/health/stripe` | OK/error + mode (test/live) |
| Email (Resend) | `/api/health/email` | OK/error + dry-run status |
| Parcel Service | `/api/health/parcel` | OK/error + county lookup on/off |
| Workforce | `/api/health/workforce` | OK/error + active technician count |

Each card shows:
- Green ✓ if `ok: true`
- Red ✗ if `ok: false`
- Gray spinner if still loading

---

## Refresh Behavior

- Health checks load automatically on page open
- "↻" button in the Live Health Checks card header re-runs all 5 checks

---

## Security

The health endpoints are public (no auth required), but they only return boolean config status. No secrets, no keys, no PII. The Debug page itself still requires admin JWT authentication.

---

## Existing Sections (unchanged)

- Environment (NODE_ENV, version)
- Stripe (mode + config booleans)
- Supabase (config booleans)
- Resend (config)
- Twilio (config)
- Live Counts (subscriptions, employees, appointments)
- Feature Flags (all 9 flags)
- Operational Status (key flags)
