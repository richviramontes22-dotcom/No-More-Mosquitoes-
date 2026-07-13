# Phase 04 — QA Account Setup Verification

**Date:** 2026-07-13  
**Sprint:** Production Launch Verification

---

## Status: PENDING USER ACTION

No QA test accounts exist in Supabase production. They must be created manually.

---

## Required Accounts

| Account | Email | Role | Purpose |
|---|---|---|---|
| QA Customer 1 | `qa-customer1@nomoremosquitoes.us` | customer | Primary RLS isolation test account |
| QA Customer 2 | `qa-customer2@nomoremosquitoes.us` | customer | Cross-customer RLS isolation test |
| QA Employee | `qa-employee@nomoremosquitoes.us` | employee | Employee portal smoke test |
| QA Customer Service | `qa-cs@nomoremosquitoes.us` | customer_service | RequireCustomerService guard test |

---

## How to Create Each Account

### Step 1: Create Auth User in Supabase Dashboard

1. Open **Supabase Dashboard → Project `qamfxqbtvwwlzlmqrqbh` → Authentication → Users → Add user**
2. Enter email + a strong password
3. Check **"Auto Confirm User"** (bypasses email confirmation)
4. Click **Create user**
5. Copy the new user's UUID

### Step 2: Set the Role in `profiles` Table

Run in SQL Editor:

```sql
-- Replace <UUID> with the actual user UUID from Step 1
UPDATE profiles SET role = 'customer' WHERE id = '<UUID>';
-- (or 'employee', 'customer_service' as appropriate)
```

### Step 3: Add a QA Property (for Customer accounts)

For the cross-customer RLS test, QA Customer 1 needs at least one property:

```sql
INSERT INTO properties (profile_id, address, city, state, zip, acreage)
VALUES ('<QA_CUSTOMER_1_UUID>', '1 QA Test Lane', 'Anywhere', 'TX', '00001', 0.25);
```

---

## Verification After Creation

Run in SQL Editor:

```sql
SELECT id, email, role, created_at
FROM profiles
WHERE email LIKE 'qa-%@nomoremosquitoes.us'
ORDER BY created_at;
```

Expected: 4 rows returned.

---

## Notes

- These are production accounts in the real Supabase project. Use them only for QA.
- Do NOT use real personal data (real addresses, real payment methods).
- After QA is complete, accounts can be deactivated (set `role = 'inactive'` in profiles)
  or left in place as permanent QA fixtures.

---

## Verdict

| Check | Status |
|---|---|
| QA accounts exist | ❌ Not created |
| Roles confirmed in profiles | ❌ Blocked on account creation |
| QA property added for RLS test | ❌ Blocked |

**Phase 04: PENDING — user must create QA accounts in Supabase dashboard.**
