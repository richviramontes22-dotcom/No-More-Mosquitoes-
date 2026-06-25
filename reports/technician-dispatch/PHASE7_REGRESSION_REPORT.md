# Phase 7 Regression Report

## Areas checked, against the brief's explicit list

| Area | Method | Result |
|---|---|---|
| Public site | Live: homepage, pricing, service area checker | Clean, 0 console errors |
| Customer dashboard | Live: `/dashboard`, `/dashboard/billing` | Clean, 0 console errors |
| Checkout / Stripe | Live: `/schedule` (quote/checkout entry point) | Clean, 0 console errors. Not touched by any Phase 7 change — no Stripe/billing files were modified this sprint |
| Service area enforcement | Not directly re-tested this phase (no Phase 7 change touched `service_areas` or quote/checkout enforcement code) | Untouched — no regression risk |
| Technician dashboard | Live: `/employee` — confirmed "Shift status" renders, GPS tracking indicator from last sprint still correct | Clean, 0 console errors |
| GPS tracking | Live: technician portal sign-in with geolocation permissions granted, dashboard renders correctly | Clean |
| Live tracking | Live: `/admin/employee-tracking` loads with "Employee Location Monitoring" heading | Clean |
| Route generation | See "Investigated finding" below — confirmed working correctly, 0 unassigned across 25/50/150-appointment scales on fresh dates | **No regression** (see below) |
| Route automation | Same benchmark run exercises the automation path (`/api/admin/routes/day/generate`) end-to-end | No regression |
| Operations Center | Live: `/admin/operations` loads with "Command Center" heading, new GPS section and Dispatch Map rendering | Clean |
| Customer service tickets | Live: `/admin/tickets` loads | Clean |
| Satisfaction / NPS | Live: `/admin/satisfaction` loads with "Customer Satisfaction" heading, new Assigned To/Due columns rendering | Clean |
| Admin dashboard | Live: `/admin`, `/admin/service-areas`, `/admin/workforce` all load | Clean |

## An apparent regression, investigated, and ruled out

An initial route-generation check (reusing the prior sprint's `scripts/audit/benchmark_route_generation.mjs`
unmodified) returned **0 routes created** across all three of its built-in scenarios — alarming on its
face, since the same script produced 25/43/43 routes with 0 unassigned in the prior sprint.

Investigated rather than assumed: queried `routes` directly for one of the script's hardcoded dates
(`2026-08-03`) and found **25 pre-existing routes already there** — left over from the prior Operations
Hardening sprint's own benchmark runs, which used the exact same three hardcoded dates
(`2026-08-03`/`04`/`05`). `dayPlanGenerator.ts`'s eligibility logic (rewritten for performance last sprint,
unchanged this sprint) explicitly excludes any technician who already has a draft/approved route for the
target date — by design, to prevent ever creating duplicate routes for the same technician/day. With every
technician already routed on those three dates from the earlier run, 0 *new* routes was the **correct**
output, not a failure.

Confirmed by re-running the identical benchmark against three genuinely fresh dates
(`2026-09-10`/`11`/`12`, verified to have zero pre-existing routes or blackout entries first):
**25, 43, and 43 routes created respectively, 0 appointments unassigned in all three** — matching or
exceeding the prior sprint's own results. This conclusively confirms route generation and automation have
no regression from any Phase 7 change; the dedup safeguard simply did exactly what it was built to do
against reused test dates. The benchmark script itself was reverted to its original three dates afterward
(a one-line `sed` edit during investigation, reverted the same way) so it remains the same general-purpose,
reusable tool documented in the prior sprint's reports — not left pointed at one-off dates.

## Test data

This investigation's fresh-date run added more test appointments/properties/routes, all owned by the same
`qa-contact-test@test.com` test profile as every other benchmark run this and the prior sprint. Confirmed
via a dry run of `scripts/admin/cleanup-test-data.mjs` that all of it (along with everything accumulated
across both sprints) is correctly within that script's scope — 1000 test appointments, 1363 test
properties, 416 test routes, etc., none of it touching the small number of real rows the script's own
ownership-based scoping leaves untouched. `--confirm` was not run, per this sprint's instructions.

## Full validation suite (re-confirmed after this investigation)

`pnpm test`: **223/223 passing.**
