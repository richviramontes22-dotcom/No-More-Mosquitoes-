# Customer Service Dashboard — Report
**Date:** 2026-06-19

## What Was Built

| Piece | File |
|---|---|
| Backend | `server/routes/customerServiceDashboard.ts` — `GET /api/admin/customer-service/dashboard`, `GET /api/admin/customer-service/customers?search=` |
| Frontend | `client/pages/admin/CustomerServiceDashboard.tsx` at `/admin/customer-service` |
| Guard | `requireCustomerService` (server), `RequireCustomerService` (client) — see `ROLE_BASED_DASHBOARDS_IMPLEMENTATION_REPORT.md` for why this is a sibling route, not nested under `/admin` |

## Content — Matches the Spec's Required List, All Reused Data

| Required | Source | Notes |
|---|---|---|
| Open tickets | `tickets` where `status = 'open'` | Reuses the ticketing system hardened in Phase 3 |
| Escalated tickets | `tickets` where `status = 'escalated'` | Same table, same enum value added in Phase 3 |
| Detractors | `customer_satisfaction_surveys` where `satisfaction_type = 'detractor' AND followup_required AND resolved_at IS NULL` | Reuses Phase 4's satisfaction system — same pending-detractor definition the admin Satisfaction page uses |
| Reschedule requests | `appointment_reschedule_requests` where `status = 'pending'` | Reuses the table built in the earlier Platform Growth Phase 2 sprint — not touched or duplicated here |
| Customer lookup | `profiles` where `role = 'customer'`, name/email search | New, narrow, read-only search endpoint |
| Recent support activity | `tickets` ordered by `updated_at` | Simple recency view over the same ticket table |
| Assigned follow-ups | **Not included** | See scope note below |

**Scope note on follow-ups:** `lead_followups` (CRM Phase 3) is assignment/sales-oriented (a salesperson following up on a lead to convert it), not a customer-service concern — the spec listed this as "if relevant," and a customer service rep resolving tickets/detractors has no natural use for sales follow-up reminders. Omitted rather than included for completeness' sake; the sales dashboard (this same phase) is where `lead_followups` actually surfaces.

## Read-Only, Confirmed

`server/routes/customerServiceDashboard.ts` contains zero `.insert(`/`.update(`/`.delete(` calls — every query is a `select`. Resolving a detractor or replying to a ticket happens on the existing Satisfaction/Tickets admin pages (which `customer_service` can also reach, since both are gated by `requireCustomerService`-equivalent staff checks added in Phase 3/4's RLS policies) — this dashboard is a landing/triage view, not a second place to perform those actions.

## Security Note: Search Input Sanitization

The customer-lookup endpoint builds a PostgREST `.or()` filter from user input (`name.ilike.%search%,email.ilike.%search%`). Raw interpolation into that filter string would let a crafted search string inject additional filter clauses (PostgREST's `.or()` syntax uses `,`, `(`, `)`, and `.` as structural characters). Fixed by stripping those four characters from the search term before interpolating — confirmed by reading the final code, not just intending to.

## Validation

`pnpm typecheck` clean, `pnpm test` 134/134.
