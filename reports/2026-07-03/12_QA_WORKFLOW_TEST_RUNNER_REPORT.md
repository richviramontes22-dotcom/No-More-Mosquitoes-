# 12 — QA Workflow Test Runner Report

**Date:** 2026-07-03

---

## Implementation Location

QA workflow test runners are implemented inside `/admin/qa-center` → "Test Runner" tab.
No separate files; all logic in `client/pages/admin/QaCenter.tsx`.

---

## Test Suites

### Customer Smoke Test

| Check | Method | Expected |
|---|---|---|
| Health endpoint reachable | `GET /api/health/database` | HTTP 200 |
| Database responsive | `/api/health/database` `ok` field | true |
| Stripe health | `GET /api/health/stripe` | HTTP 200, mode field |
| Email configured | `GET /api/health/email` `configured` | true |
| SMS provider | `/api/health/email` `smsProvider` | any (shown as detail) |
| SUPPORT_PHONE configured | `/api/health/email` `supportPhoneConfigured` | boolean (shown) |
| Customer route exists | Static (App.tsx) | confirmed |
| Marketplace route exists | Static (App.tsx) | confirmed |
| Quote invite route exists | Static (App.tsx) | confirmed |

---

### Employee Smoke Test

All checks call unauthenticated endpoints and verify HTTP 401 response. 401 = auth guard is working. 404 = endpoint doesn't exist. 200 = auth guard missing (fail).

| Check | Endpoint | Expected |
|---|---|---|
| Shift endpoint rejects unauthenticated | `GET /api/employee/shifts/current` | HTTP 401 |
| Assignment endpoint rejects unauthenticated | `GET /api/employee/assignments` | HTTP 401 |
| GPS consent grant rejects unauthenticated | `POST /api/employee/onboarding/consent/grant` | HTTP 401 |
| Location ping rejects unauthenticated | `POST /api/employee/shifts/location-ping` | HTTP 401 |
| arrived_at set on in_progress | Static (code verified) | Fixed 2026-07-02 |
| GPS consent audit parity | Static (code verified) | Fixed 2026-07-02 |

---

### Marketplace Smoke Test

| Check | Method | Expected |
|---|---|---|
| Payment intent endpoint rejects unauthenticated | `POST /api/marketplace/create-payment-intent` with empty body | HTTP 401 |
| Marketplace route exists | Static (App.tsx) | confirmed |
| Catalog items table exists | Static (production DB) | 14 items |
| Cart context implemented | Static (code) | CartContext |
| Checkout flow exists | Static (code) | Stripe Elements |

---

### Security Checklist

| Check | Method | Expected |
|---|---|---|
| SMS dry-run status | `GET /api/health/email` `smsDryRun` | boolean, shown as "dry-run (safe)" or provider |
| SUPPORT_PHONE configured | `/api/health/email` `supportPhoneConfigured` | boolean |
| Stripe mode | `GET /api/health/stripe` `mode` | test / live |
| Stripe key mismatch | `/api/health/stripe` `mismatch` | false (no mismatch) |
| RLS USING(true) removed | Static (confirmed 2026-07-02) | Fixed |
| job-media bucket private | Static (confirmed 2026-07-02) | Fixed |
| CORS restricted | Static (confirmed 2026-07-02) | Fixed |

---

## Results Display

- Each suite shows: label, status dot (✅/❌/⏳), detail badge, timing where available
- Pass count: "X/Y passed" below results
- Results stored in component state (cleared on page refresh)
- Multiple suites can run independently; results don't interfere

---

## What Is NOT Automated

These checks require real test accounts or live browser sessions:
- Cross-customer RLS isolation (two authenticated sessions)
- Marketplace full checkout (requires Stripe payment form interaction)
- Employee GPS ping (requires active shift + consent)
- Admin notification delivery (requires real email/SMS send)

These appear in the **Security Checklist** and **Pre-Launch Checklist** as manual items.
