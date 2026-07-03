# 04 — Test Persona and Test Data Strategy Report

**Date:** 2026-07-03

---

## Recommended QA Accounts

| Account | Email | Role | Purpose |
|---|---|---|---|
| QA Customer 1 | qa.customer1@nomoremosquitoes.us | customer | New/no-subscription customer |
| QA Customer 2 | qa.customer2@nomoremosquitoes.us | customer | Active subscription customer |
| QA Employee | qa.employee@nomoremosquitoes.us | employee | Technician workflow testing |
| QA Customer Service | qa.customer_service@nomoremosquitoes.us | customer_service | CS portal testing |
| QA Admin | qa.admin@nomoremosquitoes.us | admin | Admin panel testing (separate from owner admin) |

**Note:** These accounts do not exist yet. Creating them requires:
1. Supabase auth user creation (via admin SDK or `/api/dev/create-test-account`)
2. Profile upsert with correct role
3. For employee: `employees` table row with `is_test = true`

**Problem:** `/api/dev/create-test-account` only accepts `@test.com` domain and only creates `role=customer`. It also only runs in development (NODE_ENV !== "production").

**Implication:** QA accounts on the production database must be created manually in the Supabase dashboard. For the development environment, `@test.com` accounts work via the dev auth endpoint.

---

## Test Data Strategy by Role

### Customer Test Data

**QA Customer 1 (New/Empty state):**
- No property → triggers empty state in Properties page
- No subscription → triggers "Get Started" CTA in Billing
- No appointments → empty state in Appointments
- No marketplace orders → empty My Orders tab

**QA Customer 2 (Active customer):**
- 1 property added
- Active subscription (Stripe test mode `price_id`)
- 1 upcoming appointment (seed-appt prefix ID)
- 1 completed appointment
- 1 marketplace order (Stripe test payment)

**How to create (development):**
```bash
curl -X POST http://localhost:8080/api/dev/create-test-account \
  -H "Content-Type: application/json" \
  -d '{"firstName":"QA","lastName":"Customer","email":"qa1@test.com","phone":"555-0001","password":"TestPass123"}'
```
Then add property, appointment, subscription via Supabase dashboard (not via script — avoids seed-dev.ts production guard).

### Employee Test Data

**QA Employee:**
- `employees` row with `is_test = true`, `gps_consent_at = null` (test pre-consent state)
- 1 shift (clocked in/out)
- 1 assignment linked to a QA customer appointment
  - statuses to test: `scheduled` → `en_route` → `in_progress` (arrived_at) → `completed`
  - job_checklist rows (to test checklist UI)
  - chemicals_log row (to test chemical logging)
  - signature row

### Customer Service Test Data

**QA Customer Service:**
- 1 support ticket
- 1 satisfaction/NPS response
- 1 reschedule request

---

## is_test Flag Coverage

| Table | Has is_test column | Usage |
|---|---|---|
| employees | ✅ Yes | marks QA/dev employees |
| assignments | ✅ Yes | marks QA/dev assignments |
| shifts | ✅ Yes | marks QA/dev shifts |
| employee_location_pings | ✅ Yes | marks simulated GPS pings |
| leads | ✅ Yes | marks admin-generated test leads |
| properties | ❌ No | no test flag |
| profiles | ❌ No | no test flag |
| appointments | ❌ No | no test flag |
| marketplace_orders | ❌ No | no test flag |

**Recommendation:** Use email domain (`@test.com` in dev, `qa.*@nomoremosquitoes.us` in prod) as the primary test-account identifier rather than DB flags.

---

## Safety Rules for All QA Work

1. **Never use real customer account credentials for testing**
2. **Never charge real cards** — use Stripe test cards (`4242 4242 4242 4242`)
3. **Never send live SMS** — SMS provider is currently `null` (dry-run) in dev; confirm before production
4. **Mark all employee test data `is_test = true`** in tables that support it
5. **Seed script safety:** `seed-dev.ts` refuses to run against `qamfxqbtvwwlzlmqrqbh` (production) unless `SEED_ALLOW_PROD=yes_i_know`
6. **Destructive cleanup:** any reset/cleanup must require explicit `--confirm` flag; default to dry-run

---

## Implementation Decision for This Sprint

**Not auto-creating QA accounts this sprint.** Reasons:
- Production DB: `/api/dev/create-test-account` is disabled (correct — `NODE_ENV=production`)
- Manual Supabase dashboard creation is the correct path for production QA accounts
- QA Center will document the account creation process and show instructions

**What IS implemented:**
- QA Center Test Data Manager section (Section 9) with instructions
- Documentation of required QA data shape
- Dev auth endpoint instructions for local development testing
- Stripe test card reference
