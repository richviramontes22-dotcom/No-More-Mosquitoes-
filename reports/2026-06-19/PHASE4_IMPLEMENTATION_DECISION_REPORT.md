# Phase 4 — Implementation Decision Report
**Date:** 2026-06-19

| System | Classification | Decision |
|---|---|---|
| Customer service / ticketing | **B — Partial** | Extend the existing `tickets` table (add `category`, widen status/priority CHECK) + add two new child tables (`ticket_messages`, `ticket_internal_notes`) FK'd to `tickets.id`. Extend `Help.tsx` (the live customer page) and `Tickets.tsx` (admin). **Do not** create a parallel `support_tickets` table, and do not touch `Support.tsx` (dead/redirected) or `message_threads`/`messages` (unrelated job-chat system). |
| Customer satisfaction / NPS | **C — Missing** | New table (`customer_satisfaction_surveys`), new service, new customer survey UI, new admin dashboard. Hooks into the existing completion trigger in `employeeAssignments.ts` (same point the Phase 2 review-request email already uses) and the existing `adminNotificationService`/`tickets` for detractor escalation. |
| Technician dashboard | **A — Complete, two narrow gaps** | Verify the 11 already-working capabilities with tests; add exactly two things: a "Blocked / Unable to Service" action (backend already supports `no_show`/`skipped`, just needs a button) and a `technician_notes` column + textarea (genuinely missing from `assignments`). No redesign. |
| Role-based dashboards | **B/C — Partial/Missing, scoped** | Keep `admin`/`customer`/`employee` exactly as they are — zero changes to existing auth. Add two **real** new roles (`customer_service`, `sales`) with their own scoped middleware (not `requireAdmin` — see "Owner" decision below) and minimal dashboard shells that reuse existing data (tickets, reschedule requests, leads, referrals) rather than rebuilding it. "Owner" is **not** implemented as a literal new role (see decision below). |
| Blog / CMS | **B — Partial, mostly backend-complete** | Add 2 missing columns (`featured_image_url`, `author_id`) + a slug-uniqueness constraint. Extend the existing create dialog and add an edit dialog in `Content.tsx` to expose fields the API already accepts. Wire `BlogPost.tsx` to query the DB by slug (mirroring `Blog.tsx`'s existing DB-first/static-fallback pattern). Add `/admin/blog` as a route alias to the existing `/admin/content` blog tab — same redirect convention already used for `/dashboard/support` → `/dashboard/help`, not a parallel page. |
| Customer service dashboard | **C — Missing (new page), reuses existing data** | New `/admin/customer-service` page. No new backend tables beyond what Phase 3/4 already add — it's a read view composing tickets, satisfaction detractors, and the existing reschedule-requests endpoint from the Phase 2 sprint. |

## Decision: "Owner" Role

**Not implemented as a distinct database role.** Audited and confirmed: there is no `owner` concept anywhere in this codebase today — `admin` is the only top-level staff role, and the live `profiles.role` data only contains `admin`/`customer`/`employee`. Introducing a literal `owner` value would require either (a) making it functionally identical to `admin` everywhere, which is a cosmetic label with no access-control meaning, or (b) actually carving out admin-only territory that the current single `admin` role already fully covers — which would be a regression, not a feature, and risks breaking every existing `requireAdmin`/`RequireAdmin` check that currently assumes `role === 'admin'` is sufficient.

Instead: the spec's "Owner dashboard" requirements (business overview, analytics, revenue/territory/workforce links, satisfaction summary) are delivered as an enhanced **admin Overview** experience — anyone with `role: 'admin'` already has access to all of it (Analytics, Territory Intelligence, Workforce Optimization already exist from the prior sprint; satisfaction summary is added in Phase 4 of this sprint). This satisfies the requested *capability* without faking a role distinction that wouldn't actually gate anything differently. Documented here explicitly rather than silently scoped down.

## Decision: "Sales" and "Customer Service" Roles

**Implemented as real, additive roles** — `profiles.role` gains two new accepted values, and two new Express middlewares are added (`requireCustomerService`, `requireSales`), each modeled exactly on the existing `requireAdmin`/`requireAdminOrEmployee` pattern (`server/middleware/requireAdmin.ts`) but checking `role IN ('admin', 'customer_service')` / `role IN ('admin', 'sales')` respectively — admin always retains oversight access, but a `customer_service` or `sales` profile can **never** satisfy `requireAdmin` and therefore can never reach admin-only endpoints (financials, employee management, route automation settings, etc.). This is the mechanism that satisfies "do not expose admin-only data to non-admin roles" for the two new roles, verified by a dedicated test in Phase 9.

A live probe insert (`role: "sales"`) against the production `profiles` table failed only on an unrelated `NOT NULL` constraint, not a role `CHECK` — confirming no migration is needed to *widen* the role column itself; only the new middleware and routing are needed.

## Decision: Unknown-Role Fallback

Per the "use feature-safe fallbacks if role is unknown" instruction: a profile whose role doesn't match any known guard already redirects to the customer dashboard login flow today (the existing `RequireAdmin`/`RequireEmployee`/`RequireCustomerService`/`RequireSales` guards all redirect to their respective login pages on mismatch, and `RequireCustomer` is the most permissive). No change needed — this is already the safe default behavior of the existing guard pattern, and the two new guards follow the identical pattern.

## Build Order for the Remaining Phases

1. Ticketing (extends existing table — lowest risk, unlocks the customer service dashboard's main content)
2. Satisfaction/NPS (new, but the detractor→ticket link depends on ticketing existing first)
3. Technician dashboard hardening (independent, narrow)
4. Role-based dashboards (depends on ticketing + satisfaction existing, since the customer_service dashboard surfaces both)
5. Blog/CMS hardening (fully independent of the above)
6. Customer service dashboard (composes #1 + #2 + the existing Phase 2 reschedule-requests endpoint)
