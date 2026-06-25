# Role-Based Dashboards — Implementation Report
**Date:** 2026-06-19

## What Was Built

| Piece | File |
|---|---|
| Server middleware | `server/middleware/requireRole.ts` — `requireCustomerService`, `requireSales` |
| Client guards | `client/components/auth/RequireCustomerService.tsx`, `RequireSales.tsx` |
| Sales dashboard | `server/routes/salesDashboard.ts` + `client/pages/admin/SalesDashboard.tsx` at `/admin/sales` |
| Customer service dashboard | `server/routes/customerServiceDashboard.ts` + `client/pages/admin/CustomerServiceDashboard.tsx` at `/admin/customer-service` (full content detailed in `CUSTOMER_SERVICE_DASHBOARD_REPORT.md`) |
| Login redirect | `client/pages/admin/AdminLogin.tsx` — routes by canonical role after auth |

## Zero Changes to Existing Admin/Customer/Employee Routing

This was the load-bearing constraint for this phase. `client/App.tsx`'s existing `/admin` route is one parent `<Route path="/admin" element={<RequireAdmin><AdminLayout/></RequireAdmin>}>` wrapping every existing admin page as a nested child — meaning *any* route nested inside it inherits the strict `role === 'admin'` gate, with no way to carve out a partial exception from inside that subtree.

So the two new dashboards were added as **separate, sibling top-level routes** (`/admin/customer-service`, `/admin/sales`), declared outside the `/admin` parent block entirely, each with its own guard and its own minimal page shell (no `AdminLayout`, no admin nav). Concretely, this means:
- Not one existing `<Route>` under `/admin` was modified, reordered, or had its guard touched.
- A `customer_service` or `sales` profile visiting `/admin` (or any of its 25+ existing child routes) still hits the original `RequireAdmin` check and gets redirected to login — exactly as before this phase, for every role.
- `requireCustomerService`/`requireSales` are net-new middleware functions; no existing route's middleware was swapped or widened.

## "Do Not Expose Admin-Only Data" — How It's Actually Enforced

Two independent layers, not just a UI convention:
1. **No admin nav.** Both new dashboard pages are self-contained (own header, own sign-out button) — they never render `AdminLayout`, so there's no list of admin page links to even see.
2. **No admin API access.** `requireCustomerService`/`requireSales` check `role IN ('admin', <role>)` — a `sales` profile satisfies neither `requireAdmin` nor `requireCustomerService`, so it gets a 403 from any endpoint gated by either of those, including every existing admin endpoint (employee management, billing, route automation settings, etc.). The two new dashboards only call their own two new, narrowly-scoped endpoints (`/api/admin/sales/dashboard`, `/api/admin/customer-service/dashboard` + `/customers`), which only ever `select` from `leads`, `lead_followups`, `referral_codes`, `referrals`, `tickets`, `customer_satisfaction_surveys`, `appointment_reschedule_requests`, and `profiles` (role=customer only, for lookup) — verified by reading both route files; neither touches `employees`, `payments`, `subscriptions`, or any settings table.

## "Owner" Role — Not Implemented (By Design)

Per the Phase 2 decision report: no `owner` database role was introduced. `admin` already has full access to everything an "owner dashboard" would need (Analytics, Territory Intelligence, Workforce Optimization from the prior sprint; Satisfaction from this one) — adding a cosmetically-different role that grants identical access would be complexity with no access-control benefit, and was avoided per "do not overcomplicate."

## Unknown-Role Fallback

`AdminLogin.tsx`'s post-auth redirect now checks `admin` → `customer_service` → `sales`, falling through to `/dashboard` (the customer portal) for anything else — the same safe default that already existed before this phase, just made explicit for the two new cases instead of lumping them into the old binary admin/not-admin check.

## Sales Dashboard Content

Stat cards (lead count, overdue follow-ups, referral code count) + tables for leads-by-status, recent leads, and recent referrals — all read directly from the existing `leads`/`lead_followups`/`referral_codes`/`referrals` tables via the new scoped endpoint. No new lead or referral logic was written; this is a read-only window into data that already exists and is already fully managed via the existing admin CRM/referral pages.

## Validation

`pnpm typecheck` clean, `pnpm test` 134/134.
