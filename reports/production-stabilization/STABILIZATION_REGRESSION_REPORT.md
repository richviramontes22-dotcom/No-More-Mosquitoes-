# Stabilization Regression Report

Verifying that systems this sprint touched (directly or via shared files) still work, and that systems it
didn't touch weren't accidentally broken.

## Systems directly exercised live this sprint (already detailed in the per-phase reports)

| System | Verified by |
|---|---|
| Quote system | Live in-area and out-of-area address lookups against `/api/parcel/quote` |
| Checkout / Stripe / promo codes | Node-level `formatCents` verification + the marketplace floor fix; full Stripe flow was verified in the prior session's investigation, not re-run live here (no checkout code changed beyond display formatting) |
| Customer dashboard | Live contact update, ticket creation/reply, satisfaction survey (both promoter and detractor paths) |
| Technician dashboard | Live `useEmployeeAssignments` query against real data |
| Admin dashboard | Live mobile-nav Playwright verification, `/admin/visits` query fix, messages query fix |
| Customer service workflows | Live full ticket lifecycle (reply, internal note, escalate, resolve) |
| Satisfaction / NPS | Live promoter + detractor submission, detractor-to-ticket auto-creation, staff resolve |
| Ticketing | Same as customer service workflows above |
| Service areas | Live query against the real `service_areas` table (1,035 active rows) as part of the out-of-area fix |

## Systems spot-checked in this phase specifically for regression (not otherwise touched this sprint)

All tested live with a real admin session against the local dev server:

| Endpoint | Result |
|---|---|
| `/api/admin/sales/dashboard` | `200` |
| `/api/admin/leads` (CRM) | `200` |
| `/api/admin/legal` | `200` |
| `/api/admin/service-areas` | `200` |
| `/api/admin/promos/codes` | `200` |
| `/api/admin/customer-service/dashboard` | `200` |
| `/api/admin/territory-intelligence/zones` | `200` |
| `/api/admin/workforce-optimization/summary` | `200` |
| `/api/admin/routes/day?date=...` (the actual endpoint `RoutePlanning.tsx` uses) | `200` |
| `/api/admin/routes/day/unassigned?date=...` | `200` |
| `/api/admin/routes/automation-settings` | `200` |

One false alarm during this check: bare `/api/admin/routes` (no query params) returned `400` — confirmed
this is **correct, expected behavior** (`{"error":"employee_id and date required"}`), not a regression — it's
a different, parameterized endpoint than the one the actual Route Planning page calls.

## Shared-file impact review

Files changed this sprint that are imported by other, untouched code:

- `client/lib/formatCents.ts` (new) — only consumed by the two files updated to use it
  (`ScheduleFlow.tsx`, `QuoteWidgetSection.tsx`); nothing else imports the old inline `fmtCents` definitions
  that were removed.
- `client/hooks/use-property-lookup.ts` — added an optional `outOfServiceArea` field to `PropertyData`.
  Purely additive; every existing consumer (`AddPropertyDialog.tsx`, `AddressCheckerSection.tsx`,
  `QuoteWidgetSection.tsx`) ignores fields it doesn't check for, so none of the three break from this change
  — confirmed by `pnpm typecheck` passing clean.
- `client/lib/postLoginRoleCheck.ts`'s `UserRole` type — widened, not narrowed. Every existing comparison
  against the old four values still compiles and behaves identically; only new comparisons were added.
- `client/components/auth/RequireEmployee.tsx`'s `EMPLOYEE_ROLES` — exporting it doesn't change its runtime
  behavior, only its visibility for testing.

## Full test suite

`pnpm test`: **181/181 passing** (175 pre-existing tests unmodified and still green, plus 6 new) — see
`STABILIZATION_VALIDATION_REPORT.md` for the breakdown. No pre-existing test needed to change to accommodate
this sprint's fixes, which is itself a signal that nothing this sprint touched was relied upon elsewhere in
a way the existing suite would have caught as broken.

## Conclusion

No regressions found in either the live spot-checks or the automated suite. The one new piece of production
behavior that is **not yet live** is the role-constraint migration (`2026-06-22_widen_profiles_role_check.sql`)
— everything else in this report reflects current, already-deployable code.
