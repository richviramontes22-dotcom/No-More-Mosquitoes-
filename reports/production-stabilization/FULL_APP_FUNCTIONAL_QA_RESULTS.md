# Full-App Functional QA Results — This Run

Live testing against the local dev server, using a disposable `qa-contact-test@test.com` account (role
swapped between `customer` and `admin` via direct Supabase REST calls as needed — `customer_service`/`sales`
could not be tested directly as a role, since they're still blocked by the live `profiles_role_check`
constraint until `db/migrations/2026-06-22_widen_profiles_role_check.sql` is applied; tested via `admin`
instead, which the underlying code paths treat identically for the shared Tickets/Satisfaction components).
Test property and appointments created directly via the service-role API for fixture data; cleaned up where
practical, left in place where deletion risked partial-state issues — see "Test data left behind" below.

## Workflows executed live, with real results

| Workflow | Steps | Result |
|---|---|---|
| Customer support ticket | Create ticket -> customer reply -> staff reply -> staff internal note -> escalate -> resolve | **All steps passed.** `201`/`204` at every step, no errors. |
| Satisfaction survey, promoter path | Completed appointment -> submit rating 9 + comment | **Passed.** Correctly classified `"promoter"`. |
| Satisfaction survey, detractor path | Completed appointment -> submit rating 2 + issue category -> staff resolve | **Passed.** Correctly classified `"detractor"`, `followup_required: true`, resolve correctly set `resolved_at`/`resolved_by` **and auto-created a linked follow-up ticket** — confirms the detractor-to-ticket pipeline works end to end, not just the survey write. |
| Contact info update | Update name/email/phone | **Failed before the fix in this sprint** (`PGRST204`), **passed after** — see `CONTACT_UPDATE_FAILURE_REPORT.md`. |
| Out-of-area quote | Address lookup for a covered vs. a known-uncovered ZIP | **Passed after the fix in this sprint** — see `OUT_OF_SERVICE_AREA_QUOTE_FIX_REPORT.md`. |
| Waitlist signup (out-of-area) | Submit email for a 10001 (NYC) address | **Passed.** Created both a `service_area_demand_events` row and a linked `leads` row. |
| Admin messages / customer dashboard messages | Load thread, send reply | **Failed before the fix in this sprint** (`42703 column messages.from does not exist`, in *three* files, not just the one originally reported), **passed after** — see `MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item B. |
| Technician assignments/dashboard | Load assignment list | **Failed before the fix in this sprint** (`PGRST100` invalid order syntax), **passed after** — see item A in the same report. |
| `/admin/visits` | Load completed-visit list | No live failure today (no null `user_id`/`property_id` rows exist currently), but the exact failure was reproduced directly against the REST API and fixed defensively — see item D. |
| Admin/employee mobile nav | Open hamburger drawer at 390px width | **Failed before the fix in this sprint** (drawer button intercepted by the fixed global header, then mispositioned), **passed after**, verified via real Playwright screenshots for both `AdminLayout` and `EmployeeLayout`. |
| Stripe 100%-off promo display | Apply a 100%-off one-time-service code | **Failed before the fix in this sprint** (displayed `"$1"` for a 50-cent charge), **passed after** — see `STRIPE_DISPLAY_FORMAT_FIX_REPORT.md`. |

## Tested via existing automated coverage, not re-verified manually this pass

- **Blog CMS** (`server/routes/adminContent.ts`) already has a dedicated spec file
  (`adminContent.blog.spec.ts`), part of the 175 passing tests confirmed in `STABILIZATION_VALIDATION_REPORT.md`.
  Not duplicated with a live manual pass.
- **Promo code validation** (`/api/promos/validate`) — covered by the prior session's Stripe investigation,
  confirmed live working correctly (returns the right discount, correct error for expired/invalid codes).
- **Subscription/past-due/needs-scheduling admin endpoints** — tested live with a real admin session as part
  of this sprint's Phase 4D investigation; both returned correct data, no bug found.

## Not executed this pass (documented in the Plan for a future run)

Given the scope of "every button on every page across 7 role areas," this run prioritized: (a) workflows
directly tied to confirmed/suspected bugs, and (b) workflows never previously touched this session. **Not**
exercised live in this pass: route planning/automation, territory intelligence, workforce optimization,
analytics/reports/revenue dashboards, referrals, employee onboarding forms, treatment notes/media upload,
clock in/out, legal document versioning workflow, marketplace checkout (covered in an earlier session's
Stripe investigation, not re-run here), and the sales dashboard. These remain in
`FULL_APP_FUNCTIONAL_QA_PLAN.md` as the standing checklist for the next pass.

## Test data left behind (disposable, `@test.com` account only)

- Account: `qa-contact-test@test.com` (role reset to `customer` after this pass).
- One property ("123 QA Test St, Irvine"), two completed appointments, one support ticket (with messages +
  an internal note, status `resolved`), two satisfaction surveys (one promoter, one detractor — the
  detractor one auto-created a third ticket).
- All scoped to this single disposable account — no real customer data touched. Left in place rather than
  deleted to avoid partial-state FK cleanup risk across `ticket_messages` / `ticket_internal_notes` /
  `customer_satisfaction_surveys` / `service_area_demand_events` / `leads`. Flagged for cleanup alongside the
  other test accounts from the earlier mobile-audit sprint — see the final report's open items.
