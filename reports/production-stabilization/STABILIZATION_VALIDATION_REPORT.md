# Stabilization Validation Report

## New automated tests added

| File | Covers |
|---|---|
| `client/lib/formatCents.spec.ts` (new) | The exact display bug from Phase 1 — 50 cents must show `"$0.50"`, not `"$1"` — plus whole-dollar and locale-grouped cases. `fmtCents` was extracted from `ScheduleFlow.tsx` and `QuoteWidgetSection.tsx` (both had their own duplicate copy) into a single shared, now-testable `formatCents()` in `client/lib/formatCents.ts`. |
| `client/components/auth/RequireEmployee.spec.ts` (new) | The role-routing regression found in Phase 4C — every employee-portal role (including `dispatcher`, `customer_service`, `sales`) must be in `EMPLOYEE_ROLES`; plain `customer` must not be. `EMPLOYEE_ROLES` was exported from `RequireEmployee.tsx` to make this directly testable. |

## Items from the Phase 6 checklist not covered by a new automated test, and why

- **Contact update success, out-of-area blocking, technician assignment list, admin messages query** — all
  four are fundamentally "does this Supabase/PostgREST query work" questions. Each was verified by
  reproducing the exact failure and the exact fix **live, against the real database**, with the literal
  Postgres/PostgREST error codes captured (`PGRST204`, `PGRST100`, `42703`, `22P02` /
  `profiles_role_check` `23514`) — see `FULL_APP_FUNCTIONAL_QA_RESULTS.md` and `FULL_APP_BUG_REGISTER.md`.
  A mocked unit test would only re-assert that the mock returns what it's told to return; the live
  reproduction is the more rigorous evidence for this class of bug; no new mock-heavy test was added on top
  of it.
- **Mobile nav renders collapsed below 1024px** — not meaningfully testable via `jsdom` (Tailwind responsive
  classes are real CSS that requires an actual rendered viewport to take effect; jsdom doesn't lay out
  styles at all). Verified instead with real Playwright screenshots at a 390px viewport for both
  `AdminLayout` and `EmployeeLayout`, captured during Phase 4E — a strictly better verification method for
  this specific claim than a unit test would have been.
- **Support/customer workflows unaffected** — covered by the full existing suite continuing to pass (no
  regressions), not a new test.

## Validation commands

| Command | Result |
|---|---|
| `pnpm typecheck` | Clean. |
| `pnpm test` | **181 passed** (175 pre-existing + 6 new), 21 test files, 0 failures. |
| `pnpm build` | Succeeds (client + server). Same pre-existing dynamic/static import warnings as before this sprint — not introduced by this work. |
| `pnpm bundle:functions` | All 7 Netlify functions bundle successfully. |

## What was not changed

No production database was migrated by this sprint's tooling — `db/migrations/2026-06-22_widen_profiles_role_check.sql`
is written and ready but requires manual application via the Supabase SQL Editor (see
`MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md` item C and `PRODUCTION_STABILIZATION_FINAL_REPORT.md`).
