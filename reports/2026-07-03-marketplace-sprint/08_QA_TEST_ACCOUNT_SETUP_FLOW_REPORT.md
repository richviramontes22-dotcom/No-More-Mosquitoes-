# 08 — QA Test Account Setup Flow Report

**Date:** 2026-07-03

---

## Approach Selected

**Option A — Guided documentation in the QA Center** (already implemented in `/admin/qa-center` from prior sprint)

No production test account auto-creation. The QA Center already includes a "Test Data Manager" tab with recommended account specs and manual setup steps.

---

## Recommended QA Accounts

| Email | Role | Purpose |
|---|---|---|
| `qa.customer1@nomoremosquitoes.us` | customer | Primary customer QA — dashboard, billing, marketplace |
| `qa.customer2@nomoremosquitoes.us` | customer | Cross-RLS isolation test (must NOT see customer1 data) |
| `qa.employee@nomoremosquitoes.us` | employee/technician | Employee portal, GPS, assignments |
| `qa.cs@nomoremosquitoes.us` | customer_service | CS portal, tickets, satisfaction |
| `qa.admin@nomoremosquitoes.us` | admin | Admin panel QA (separate from owner account) |

---

## Creating QA Accounts in Production (Manual Steps)

### Via Supabase Dashboard

1. Go to: **Authentication → Users → Invite user** in the Supabase dashboard for project `qamfxqbtvwwlzlmqrqbh`
2. Create the user with the QA email
3. After creation, find the user's UUID in Authentication → Users
4. Run in SQL Editor to set their role:

```sql
-- Replace {UUID} and {ROLE} with the actual values
INSERT INTO profiles (id, role, name)
VALUES ('{UUID}', '{ROLE}', 'QA Test Account')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
```

5. For customer accounts, also create a test property:

```sql
INSERT INTO properties (user_id, address, city, state, zip, acreage)
VALUES ('{UUID}', '100 Test Ave', 'Anaheim', 'CA', '92801', 0.25);
```

### Via dev-only API (local dev only, blocked in production)

```bash
curl -X POST http://localhost:8080/api/dev/create-test-account \
  -H "Content-Type: application/json" \
  -d '{"email":"qa.customer1@test.com","password":"TestPass123!","role":"customer"}'
```

Note: `POST /api/dev/create-test-account` is only mounted when `NODE_ENV !== "production"`. It only accepts `@test.com` emails and only creates customer-role accounts.

---

## Stripe Test Cards (Marketplace QA)

| Card | Number | Use |
|---|---|---|
| Success | `4242 4242 4242 4242` | Normal purchase |
| Authentication required | `4000 0025 0000 3155` | 3DS flow |
| Insufficient funds | `4000 0000 0000 9995` | Payment failure |

Use any future expiry (e.g. 12/28), any 3-digit CVC, any ZIP.

---

## Cross-Customer RLS Isolation Test

**Requires:** Two real customer accounts (qa.customer1 and qa.customer2)

Steps:
1. Log in as qa.customer1 — create a payment or subscription via Stripe test checkout
2. Note the subscription/payment IDs
3. Log out, log in as qa.customer2
4. Attempt to access qa.customer1's data via API:
   ```bash
   curl "https://nomoremosquitoes.us/api/some-endpoint" \
     -H "Authorization: Bearer <qa.customer2-token>"
   ```
5. Verify the response does NOT include qa.customer1's subscriptions, payments, or properties

This test is a pre-launch requirement — documented here as a manual blocking item.

---

## Status

- QA account guidance: ✅ Documented in QA Center "Test Data Manager" tab (from prior sprint)
- Actual QA accounts: ❌ NOT created — requires manual Supabase dashboard action
- This is a manual pre-launch blocker for the cross-RLS isolation test only
- All other QA can be done with existing admin account + public endpoints
