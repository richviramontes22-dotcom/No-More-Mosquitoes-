# Production Stabilization + Full Functional QA Sprint — Final Report

## 1. Was the Stripe $1 display bug fixed?

Yes. Root cause: `fmtCents()`'s `.toFixed(0)` rounds 50 cents up to the string `"$1"`. Fixed in a new shared
`client/lib/formatCents.ts` (replacing three duplicate inline copies), with a regression test
(`formatCents.spec.ts`). The marketplace checkout's *separate* floor-mismatch bug (display floored at $0,
backend floors at Stripe's $0.50 minimum) was also found and fixed while auditing this.

## 2. Was contact information update fixed?

Yes. Root cause: `Profile.tsx` sent `updated_at` in its update payload; `profiles` has no such column —
PostgREST rejects the *entire* update when one field is invalid, so name/email/phone never saved either.
100% reproduction rate before the fix (every customer, every time), confirmed by reproducing the exact
`PGRST204` error live and then the `200` success after removing the bad field.

## 3. Was out-of-service-area manual acreage blocked?

Yes, on the two public-facing paths that previously allowed it unconditionally
(`QuoteWidgetSection.tsx`, and `AddressCheckerSection.tsx`'s waitlist signup was also wired up — it
previously did nothing at all). `/api/parcel/quote`'s service-area check was promoted from a
fire-and-forget-only side effect to a synchronous check included in the response. `AddPropertyDialog.tsx`
(account/property management, not a quote/checkout flow) still allows saving an out-of-area property with a
clear "scheduling won't be available" warning rather than a hard block — a deliberate scope decision, not
an oversight; documented in `OUT_OF_SERVICE_AREA_QUOTE_FIX_REPORT.md`.

## 4. Were mobile audit priority bugs fixed?

Yes, all six (A-F), plus the bug count was *higher* than scoped in two places: item B's `messages.from`
bug existed in three files, not one; item C's role-constraint problem blocked two more roles
(`technician`, `dispatcher`) than the two named in the brief. Full detail in
`MOBILE_AUDIT_PRIORITY_FIXES_REPORT.md`.

## 5. Were customer_service/sales roles fixed?

Fixed in code and migration, **not yet live**. The migration
(`db/migrations/2026-06-22_widen_profiles_role_check.sql`) widens `profiles_role_check` to allow
`technician`, `dispatcher`, `sales`, and `customer_service` (currently all four are rejected with a `23514`
violation, confirmed by testing every role value directly against the live constraint). **Requires manual
application via the Supabase SQL Editor** — there is no migration runner in this project, consistent with
every prior migration this project has used. Three related routing bugs were also found and fixed while
verifying this (`RequireEmployee.tsx` missing `dispatcher`; `AdminLogin.tsx` and `Login.tsx` redirecting
these roles to dead/wrong routes).

## 6. Was technician dashboard fixed?

Yes. `useEmployeeAssignments.ts` used PostgREST `.order()` syntax that doesn't exist for ordering parent
rows by an embedded resource's column (`PGRST100`, reproduced live). Fixed by sorting client-side after
fetch. One hook fix covers both `Dashboard.tsx` and `Assignments.tsx`.

## 7. Was admin messages fixed?

Yes — and so were the two customer-facing message pages with the identical bug
(`dashboard/Messages.tsx`, `dashboard/Help.tsx`), neither of which was in the original report. All three
used a nonexistent `from` column; the real column is `direction` (`"inbound"`/`"outbound"`), already the
correct convention used elsewhere in this codebase.

## 8. Was mobile navigation improved?

Yes. `AdminLayout.tsx` and `EmployeeLayout.tsx` both previously rendered their full sidebar as a stacked
block above page content below 1024px. Both now hide the sidebar and use a hamburger + slide-out drawer
(the existing `Sheet` primitive, not a new dependency). Two real bugs were found and fixed while building
this: the trigger button was first intercepted by the site's own fixed global header, then (after a guessed
fix) still rendered partially under it — resolved by placing the trigger inside the same padded container
the rest of each page's content already correctly uses, verified by direct pixel measurement and real
Playwright screenshots of both drawers opening correctly.

## 9. Was a full-app QA plan created?

Yes — `FULL_APP_FUNCTIONAL_QA_PLAN.md` (the standing, reusable checklist across all 7 role areas),
`FULL_APP_FUNCTIONAL_QA_RESULTS.md` (this run's real, live-executed results — not simulated), and
`FULL_APP_BUG_REGISTER.md` (17 tracked bugs, 16 fixed, 1 fixed-pending-migration).

## 10. Were tests/build successful?

Yes. `pnpm typecheck`: clean. `pnpm test`: **181/181 passing** (175 pre-existing + 6 new, across 21 files).
`pnpm build`: succeeds, same pre-existing warnings as before this sprint. `pnpm bundle:functions`: all 7
Netlify functions bundle successfully.

## 11. What bugs remain?

- **BUG-10** (role constraint): fixed in code/migration, blocked on manual SQL Editor application.
- Items explicitly out of scope per this sprint's own constraints and documented as such, not fixed:
  marketplace promo display was fixed for the floor-mismatch, but no broader marketplace audit was run;
  `ScheduleFlow.tsx` doesn't re-validate service-area coverage at the property-selection/checkout step for a
  property saved via `AddPropertyDialog`'s out-of-area allowance (a residual, narrow gap — see
  `OUT_OF_SERVICE_AREA_QUOTE_FIX_REPORT.md`); legal-pages-unpublished is a content/admin action, not a bug.
- Full-app QA explicitly did **not** exercise live this pass: route planning/automation UI clicks
  (endpoints were spot-checked, not the full UI), territory intelligence/workforce optimization/analytics
  dashboards beyond a load check, employee onboarding forms, treatment notes/media upload, clock in/out,
  legal document versioning workflow, and the sales dashboard UI (endpoint checked, not the page). These
  remain in the QA Plan as the standing checklist for the next pass.

## 12. Final recommendation

**CONDITIONAL GO.**

Every confirmed bug in this sprint's mandate is fixed in code, validated by either live reproduction against
real data or the full automated test suite (181/181), with zero regressions found in either the targeted
spot-checks or the existing suite. The one open condition: **apply
`db/migrations/2026-06-22_widen_profiles_role_check.sql` via the Supabase SQL Editor** before
technician/dispatcher/sales/customer_service roles can actually be assigned in production — the code is
ready and waiting on that single manual step. Everything else in this report is unconditionally ready to
ship.

## Open items for the user

1. Apply the role-constraint migration (above).
2. Decide whether to keep or clean up the QA test account/data created this session
   (`qa-contact-test@test.com` — one property, two completed appointments, one resolved ticket, two
   satisfaction surveys, one auto-created follow-up ticket — all isolated to this single disposable
   account; see `FULL_APP_FUNCTIONAL_QA_RESULTS.md`).
3. Decide whether to keep `playwright` as a dev dependency (added in an earlier session's mobile audit,
   reused this sprint for the mobile-nav verification) or have it removed.
