# ANNUAL EXPIRATION AUTOMATION FIX
## Generated: 2026-05-29
## Phase 3 of the Final Operational Integrity Sprint

---

## Problem Confirmed

**Audit Reference:** CASCADE_RULE_AUDIT.md Event 5, INVALID_STATE_ANALYSIS.md IS-3

Annual subscriptions (`program = 'annual'`) use PaymentIntents, not Stripe Subscriptions. There is no Stripe webhook for "annual plan expired." The `current_period_end` field is set to `purchase_date + 365 days` when the annual plan is created, but no code ever transitions the subscription from `active` to `expired` when that date passes.

**Impact:** Annual subscriptions remain `status = 'active'` indefinitely after expiry. Service could be delivered for years after an annual plan expires with no payment received.

---

## Fix Implemented

### New Netlify Scheduled Function

**File created:** `netlify/functions/expire-annual-plans.ts`

This function runs daily at 9:00 AM UTC (after `send-reminders` at 7 AM and `generate-appointments` at 8 AM). It:

1. Queries for all annual subscriptions where `status = 'active'` AND `current_period_end < NOW()`.
2. For each expired subscription, updates `status = 'expired'`.
3. Creates an admin alert ticket (using the `tickets` table) so the owner knows to reach out for renewal.
4. Ticket creation is deduplicated by subject + date — re-runs on the same day don't create duplicate tickets.
5. All errors are non-fatal per-row: one failure doesn't stop the other expirations from being processed.

### netlify.toml Entry Added

```toml
[functions.expire-annual-plans]
  schedule = "0 9 * * *"
```

---

## Implementation Notes

**Import style:** Follows `generate-appointments.ts` pattern — uses top-level `import` for `dotenv/config`. Uses `createClient` from `@supabase/supabase-js` directly (same approach as `send-reminders.ts` fallback logic, but inline since this function has no shared service module to import).

**tickets.user_id is NOT NULL:** The `tickets` table requires `user_id` (see `2025-11-25_tickets_table.sql`). The function uses `sub.user_id` as the ticket owner. If `user_id` is null on the subscription row, ticket creation is skipped gracefully.

**Env variable fallback:** Tries `SUPABASE_URL` then `VITE_SUPABASE_URL`; tries `SUPABASE_SERVICE_ROLE_KEY` then `VITE_SUPABASE_ANON_KEY`.

---

## Idempotency

- `.eq("status", "active")` means already-expired subscriptions are not re-processed.
- Ticket deduplication by `subject + date` prevents duplicate alerts on retry.

---

## Migration Required

None. Uses existing `subscriptions` and `tickets` tables.

---

## Verification Query

```sql
-- Should return 0 after function has run today
SELECT id, user_id, current_period_end, status
FROM public.subscriptions
WHERE program = 'annual'
  AND status = 'active'
  AND current_period_end < NOW();
```

---

## Rollback

1. Remove the `[functions.expire-annual-plans]` entry from `netlify.toml`.
2. Delete `netlify/functions/expire-annual-plans.ts`.
3. Optionally revert expired subscriptions: `UPDATE subscriptions SET status = 'active' WHERE status = 'expired' AND program = 'annual';` (do only if needed).
