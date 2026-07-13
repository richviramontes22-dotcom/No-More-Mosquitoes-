# Phase 05 — Cross-Customer RLS Isolation Test

**Date:** 2026-07-13  
**Sprint:** Production Launch Verification

---

## Status: BLOCKED — Requires QA Accounts (Phase 04)

This test cannot run until two QA customer accounts exist with separate properties and subscriptions.

---

## What This Test Verifies

That RLS policies on `properties`, `subscriptions`, `payments`, and `appointments` prevent
Customer B from reading or writing Customer A's rows, even with a valid auth token.

The RLS policies were applied in the security closure sprint (`50625f6`, 2026-07-02) and
are confirmed in the codebase, but have NOT been live-tested with real cross-customer sessions.

**This is the highest-priority pre-launch blocker.**

---

## Manual Test Steps (to perform after Phase 04)

### Setup

1. Log in as QA Customer 1 at `https://nomoremosquitoes.us/login`
2. Note the property ID from `/dashboard/properties` (or Supabase → Table Editor → properties)
3. Open a second browser (or incognito window)
4. Log in as QA Customer 2

### Test A: Property isolation

From QA Customer 2's session, try to access Customer 1's property via the API:

```bash
# Get Customer 2's Bearer token from browser DevTools → Application → Local Storage
# Look for supabase.auth.token → access_token

curl https://nomoremosquitoes.us/api/customer/properties \
  -H "Authorization: Bearer <CUSTOMER_2_TOKEN>"
# Expected: returns only Customer 2's properties, NOT Customer 1's
```

### Test B: Subscription isolation

```bash
curl https://nomoremosquitoes.us/api/customer/subscriptions \
  -H "Authorization: Bearer <CUSTOMER_2_TOKEN>"
# Expected: returns only Customer 2's subscriptions (empty if none)
```

### Test C: Direct Supabase row attempt (SQL Editor)

```sql
-- Paste Customer 1's property_id here
SELECT * FROM properties WHERE profile_id = '<CUSTOMER_1_UUID>';
-- When run via the anon key (not service role), this should return 0 rows
-- because RLS filters by auth.uid()
```

### Test D: Dashboard cross-contamination check

In QA Customer 2's browser tab:
- Navigate to `/dashboard` — should see only Customer 2's data
- Navigate to `/dashboard/appointments` — should see only Customer 2's appointments
- Navigate to `/dashboard/properties` — should see only Customer 2's properties

---

## Expected RLS Behavior (per applied policies from 50625f6)

| Table | Policy | Expected result |
|---|---|---|
| `properties` | `profile_id = auth.uid()` | Customer B sees only their rows |
| `subscriptions` | `profile_id = auth.uid()` | Customer B sees only their rows |
| `payments` | `profile_id = auth.uid()` | Customer B sees only their rows |
| `appointments` | via subscription join | Customer B sees only their appointments |

---

## Pass Criteria

- Customer 2 sees zero rows from Customer 1 across all tested tables.
- No API endpoint returns cross-customer data.
- No 500 errors — all returns are 200 with empty arrays or the customer's own data.

---

## Verdict

| Check | Status |
|---|---|
| QA accounts available | ❌ BLOCKED (Phase 04) |
| Property isolation verified | ❌ BLOCKED |
| Subscription isolation verified | ❌ BLOCKED |
| Payment isolation verified | ❌ BLOCKED |
| Dashboard cross-contamination check | ❌ BLOCKED |

**Phase 05: BLOCKED — Complete Phase 04 first, then execute manual test steps above.**

**This is the highest-priority pre-launch blocker. Do not accept real paying customers before completing this test.**
