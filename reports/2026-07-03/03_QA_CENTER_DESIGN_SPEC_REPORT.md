# 03 — QA Center Design Spec Report

**Date:** 2026-07-03

---

## Route

`/admin/qa-center` — RequireAdmin guard, AdminLayout wrapper

Nav entry: **System** group → "QA Center" (TestTube2 icon or FlaskConical)

---

## Section Architecture

The QA Center is a single-page admin tool organized into 10 tabs/sections.

### Section 1 — Overview

Pull live data from health endpoints on page load. Display:

- Environment badge: `development` / `production`
- App URL (from `import.meta.env.VITE_APP_URL` or `APP_BASE_URL`)
- Stripe mode: `test` / `live` / unknown (from `/api/health/stripe`)
- SMS provider: `telnyx` / `twilio` / `null` (from `/api/health/email`)
- SMS dry-run: boolean
- Resend email configured: boolean
- SUPPORT_PHONE configured: boolean
- Last health check timestamp
- Manual pre-launch checklist (static items, user marks as done):
  1. Cross-customer RLS isolation test performed
  2. SUPABASE_ACCESS_TOKEN not in Netlify env vars
  3. STRIPE_SECRET_KEY is live key in Netlify
  4. SUPPORT_PHONE set in Netlify
  5. APP_BASE_URL set to https://nomoremosquitoes.us
  6. GPS consent attorney review complete
  7. Resend sender domain verified
  8. Supabase PITR enabled

### Section 2 — Customer App Preview

Cards for each customer-facing route:

| Card | Route | Required Auth | Preview Mode |
|---|---|---|---|
| Customer Login | `/login` | None | Open in tab |
| Customer Dashboard | `/dashboard` | customer JWT | Open in tab |
| Billing | `/dashboard/billing` | customer JWT | Open in tab |
| Appointments | `/dashboard/appointments` | customer JWT | Open in tab |
| Properties | `/dashboard/properties` | customer JWT | Open in tab |
| Marketplace | `/dashboard/marketplace` | customer JWT | Open in tab |
| Help/Tickets | `/dashboard/help` | customer JWT | Open in tab |
| Profile | `/dashboard/profile` | customer JWT | Open in tab |
| Quote Flow | `/` (address checker) | None | Open in tab |
| Onboarding | `/onboarding` | customer JWT | Open in tab |

Each card shows: route path, purpose, required role, "Open Route" button.

### Section 3 — Employee App Preview

Cards for each employee-facing route:

| Card | Route | Required Auth |
|---|---|---|
| Employee Login | `/employee/login` | None |
| Employee Dashboard | `/employee` | employee JWT |
| Assignments | `/employee/assignments` | employee JWT |
| Assignment Detail | `/employee/assignments/:id` | employee JWT |
| Route Map | `/employee/route` | employee JWT |
| Profile / GPS Consent | `/employee/profile` | employee JWT |
| Timesheets | `/employee/timesheets` | employee JWT |
| Onboarding | `/employee/onboarding` | employee JWT |

### Section 4 — Customer Service Preview

Cards for customer service role:

| Card | Route | Required Auth |
|---|---|---|
| CS Dashboard | `/employee` | customer_service JWT |
| Tickets | `/employee/tickets` | customer_service JWT |
| Satisfaction | `/employee/satisfaction` | customer_service JWT |
| Reschedule Requests | `/employee/reschedule-requests` | customer_service JWT |

### Section 5 — Workflow Test Runner

Buttons that execute safe API checks:

**Customer Smoke Test**
- Health endpoint: `GET /api/health/database`
- Stripe health: `GET /api/health/stripe`
- Email health: `GET /api/health/email`
- Routes exist (check navigation config)
- Display: pass/fail per check with timing

**Employee Smoke Test**
- Shift endpoint requires auth: `GET /api/employee/shifts/current` (expect 401 without token)
- Assignment endpoint requires auth: `GET /api/employee/assignments` (expect 401)
- GPS consent endpoint exists: check route is registered (via 401 response, not 404)
- Location ping endpoint rejects unauthenticated: `POST /api/employee/shifts/location-ping` → expect 401

**Marketplace Smoke Test**
- Catalog items load: count from DB status
- Marketplace route accessible (admin can browse)
- Payment intent endpoint requires auth: `POST /api/marketplace/create-payment-intent` → expect 401

**Security Checklist**
- job-media bucket private: DB query via health-like endpoint (if available) or static status from prior sprint
- SMS dry-run / provider status from `/api/health/email`
- Stripe mode from `/api/health/stripe`
- USING(true) RLS: static from prior sprint (confirmed fixed 2026-07-02)

### Section 6 — Marketplace / Add-On Store Review

Read-only admin review of the customer marketplace:
- Show current catalog items (call catalog endpoint or direct read)
- Show item count by category
- Highlight items with missing descriptions
- Show inactive items
- Link to `/dashboard/marketplace` to view as customer experience
- Link to admin catalog management (if route exists, otherwise note gap)

### Section 7 — Responsive Preview

Visual guide for responsive testing:

Viewport reference table:
- 320 × 568 — Minimum supported mobile
- 360 × 780 — Android small
- 390 × 844 — iPhone 14 Pro
- 414 × 896 — iPhone 11 Plus
- 430 × 932 — iPhone 15 Plus
- 768 × 1024 — iPad portrait
- 1024 × 768 — iPad landscape / small laptop
- 1366 × 768 — Common laptop
- 1440 × 900 — Standard desktop

For each viewport: label + notes on what to test manually.

Iframe preview: **Not implemented in this sprint.** Iframes for authenticated routes are blocked by the same-origin auth cookie and layout constraints. Approach is route-launch buttons + viewport reference table. Document limitation clearly.

### Section 8 — Security / RLS Test Checklist

Interactive checklist (local state, not persisted to DB):

| Item | Type | Status |
|---|---|---|
| USING(true) RLS removed (payments, subscriptions, job_checklists, chemicals_logs, signatures) | Auto (from prior sprint) | ✅ Fixed 2026-07-02 |
| job-media bucket private | Auto (from prior sprint) | ✅ Fixed 2026-07-02 |
| GPS timestamps server-controlled | Auto | ✅ Confirmed 2026-07-02 |
| GPS consent audit parity | Auto | ✅ Fixed 2026-07-02 |
| CORS restricts unknown origins | Auto | ✅ Fixed 2026-07-02 |
| arrived_at set on in_progress | Auto | ✅ Fixed 2026-07-02 |
| Cross-customer RLS isolation (two real accounts) | Manual | ⬜ Not yet performed |
| SUPABASE_ACCESS_TOKEN not in Netlify | Manual | ⬜ Verify in Netlify |
| Stripe live key in Netlify for production | Manual | ⬜ Verify in Netlify |

### Section 9 — Test Data Manager

Display:
- Recommended QA account email list
- Dev auth endpoint availability (only in dev — will show "Not available in production")
- Instructions for creating test accounts via `/api/dev/create-test-account`
- Note: seed-dev.ts refuses to run against production DB

No auto-creation of test accounts (requires explicit user action). No destructive cleanup without `--confirm`.

### Section 10 — Reports / Last Test Runs

Links to sprint reports in `reports/`:
- `reports/2026-07-02/` — Full site/system audit (23 reports)
- `reports/2026-07-02-security-closure/` — Security closure sprint (15 reports)
- `reports/2026-07-03/` — This sprint (15 reports)
- Last workflow test results (component state, cleared on page refresh)

---

## Explicitly Rejected: Full Admin Impersonation

Full arbitrary user impersonation (generating a JWT for another user's identity) is NOT implemented this sprint. Reasons:
- Requires: stronger audit logs, read-only session enforcement, session isolation guarantee, legal/privacy review
- Risk: could be misused to read/mutate real customer data without consent audit trail
- Future sprint: implement with explicit `is_impersonation_session`, audit log, read-only guard, and time-limited tokens

Admins who need to review customer experience should use dedicated QA test accounts.

---

## Implementation Notes

- **No new DB tables required** — QA Center is entirely client-side + existing health endpoints
- **No new auth endpoints** — uses existing `/api/health/*`
- **No user impersonation** — route-launch buttons open in new tab with current admin session (correct, admin can see their own routes)
- **No mock data injection** — mock preview is the route card + description approach
- **Checklist state** — `localStorage` keyed to admin user ID, persists across page refreshes
