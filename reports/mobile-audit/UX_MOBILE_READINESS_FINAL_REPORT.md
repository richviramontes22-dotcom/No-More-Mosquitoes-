# UX Mobile Readiness Sprint — Final Report

**Date**: 2026-06-19

## 1. Was the homepage banner fixed?

Yes. Root cause: text at 55% opacity on a 10%-opacity background, plus a header-height/spacer mismatch
that the fix's increased visibility exposed (the band was rendering partly under the fixed header on
mobile). Both fixed in `client/components/sections/HeroSection.tsx`. Full detail in
`BANNER_VISIBILITY_AUDIT.md`.

## 2. Does it pass desktop/mobile visibility?

Yes. Measured contrast ratio: **6.52:1** (exceeds WCAG AA's 4.5:1 for normal text, close to AAA's 7:1).
Verified visually on desktop (1440px), mobile (iPhone 13, 390px), and tablet (820px) — clean on all three,
no header overlap, no readability issues.

## 3. How many pages were audited?

**72 distinct pages/routes** across public marketing, customer portal, employee/technician portal,
customer-service tools, and admin portal. See `MOBILE_SCREENSHOT_INDEX.md` for the full list and how the
brief's page list was mapped onto this app's actual routes.

## 4. How many screenshots were captured?

**1,027 screenshots**, across a 12-device matrix (4 devices on every page; 8 additional devices on the 7
highest-traffic "flagship" pages) — see the Tier 1 / Tier 2 breakdown in `MOBILE_SCREENSHOT_INDEX.md`.

## 5. Which pages received D or F?

**D**: Employee Dashboard, Employee Assignments (list), Admin Visits, Admin Messages — all four for the same
reason class: each has a confirmed, real backend bug causing actual data/functionality to fail, independent
of mobile rendering (every one of these pages *displays* cleanly on every device tested — the grade reflects
that the data underneath them doesn't actually load).
**F**: none. No page was found fully broken/unusable on mobile in this audit.

## 6. Which issues are blocking revenue/customer conversion?

- The 4 public legal pages showing "Document not yet published" live in production — a visitor checking
  terms/privacy before booking sees nothing.
- Homepage Slow-4G load time (~16s to meaningful content, ~49s to full settle) — a real but secondary
  concern; the actionable CTAs are visible well before full load.
- Nothing was found that actually *blocks* a customer from completing checkout on mobile — the schedule/
  payment flow renders cleanly at every step (the underlying Stripe/Retry-button bugs found earlier this
  session are already fixed and live, separate from this audit).

## 7. Which issues are blocking technician operations?

**Yes, one confirmed, real, and currently live**: `useEmployeeAssignments`'s invalid PostgREST order syntax
means a technician's Dashboard and Assignments list always show empty/zero, even with real assigned jobs.
This is the single most consequential finding in this entire audit — it blocks the core reason a technician
opens the app, today, in production, on any device. The "Today's Route" page is unaffected (different,
working endpoint).

## 8. Which admin/customer-service pages are not mobile-ready?

None are *unusable* — but **all 36 admin pages and all 10 employee-portal pages** share the same structural
problem: navigation doesn't collapse below 1024px, so every single one of those 46 pages makes a phone user
scroll past the full nav before reaching content. That's a "not optimized," not a "broken," finding — but at
46 pages it's the highest-reach issue in the whole audit. Additionally, Admin Visits and Admin Messages have
real functional bugs (see Q5).

## 9. Are customer-facing pages mobile-ready?

**Yes, with two caveats.** Layout fundamentals are clean across all 19 public pages and 7 customer-portal
pages — zero horizontal overflow detected anywhere in 1,027 screenshots, forms render correctly, the
hamburger nav works. The caveats: the recurring chat-widget text overlap (minor, cosmetic) and the legal-
pages content gap (not a code issue). The homepage banner — the one defect explicitly reported — is fixed
and verified.

## 10. Are technician workflows mobile-ready?

**The screens are ready; the data underneath one of them isn't.** Every technician-facing page renders
cleanly on mobile (modulo the nav-collapse issue shared with the whole portal). But the Dashboard and
Assignments list are non-functional due to the confirmed backend bug in Q7 — so "mobile-ready" in the visual
sense, not yet in the functional sense, for those two specific pages. Route, Messages, Timesheets, Profile,
and Onboarding are both visually and functionally fine today.

## 11. Are customer service workflows mobile-ready?

**The tools are; the role-assignment isn't.** Tickets, Satisfaction, and Reschedule Requests all render and
function correctly on mobile when accessed (verified via the admin test account, which the same guard
permits). But no real `customer_service` account can exist in production today — the database constraint
that would allow assigning that role has never been updated. Same root issue affects `sales`.

## 12. Which mobile fixes should be implemented next?

In order (full detail and reasoning in `MOBILE_FIX_PRIORITY_REPORT.md`):
1. The three Priority-0 backend bugs (assignments order syntax, messages column, role constraint) — all
   small, all high-impact.
2. Publish the four legal documents.
3. Admin/employee portal mobile nav collapse — highest-reach design fix (46 pages).
4. Homepage Slow-4G payload investigation.

## 13. Is a technician mobile app recommended?

**Not immediately — conditionally, for the medium term.** Today's responsive web app already implements
roughly 70% of the needed business logic (auth, time tracking, assignments, routing, media upload, notes).
The one requirement a web app fundamentally cannot satisfy is **continuous background location tracking
while clocked in** (a hard OS-level ceiling on iOS in particular, not an engineering-effort problem). If
that's a genuine product requirement, a native app is justified. If foreground-only location pings (today's
actual behavior) are acceptable, it isn't needed yet. See `TECHNICIAN_APP_FEASIBILITY_STUDY.md` Section 3
for the full reasoning, and the Phase 0/1 roadmap items that should happen regardless of this decision.

## 14. If yes, which architecture and why?

**React Native**, not Flutter or PWA-only. PWA closes the offline/installability/Android-push gap cheaply
but cannot deliver reliable background location on iOS — a hard ceiling, not a future fix. Between React
Native and Flutter, React Native wins specifically *for this team*: it reuses their existing React/
TypeScript investment with no new-language ramp-up, against no countervailing capability advantage for
Flutter on this app's actual requirements (forms, lists, maps, status workflow — not graphics-heavy).
Full comparison in `TECHNICIAN_APP_ARCHITECTURE.md`; cost breakdown in `TECHNICIAN_APP_COST_ANALYSIS.md`.

## 15. Final recommendation

**CONDITIONAL GO.**

- **Banner fix**: shipped, verified, no further action needed.
- **Mobile layout fundamentals**: solid — go ahead and treat the platform as mobile-ready for customers and
  for browsing/reviewing on staff devices.
- **Condition before calling technician/customer-service mobile operations "ready"**: fix the three
  Priority-0 backend bugs (Q7/Q9/Q11 above) — none are mobile-specific, all are small, and until they're
  fixed, "mobile-ready" screens are sitting in front of non-functional or unreachable data for two real
  job-critical workflows.
- **Technician native app**: no go yet — re-evaluate once Phase 0/1 of the roadmap (fix the read-side of
  location pings, ship a PWA layer) is in place and there's a validated, not assumed, need for true
  background GPS.

## Sprint constraints honored

- Only the homepage banner was implemented (`client/components/sections/HeroSection.tsx`) — confirmed via
  `git status`: no other tracked source file was modified.
- No database migrations created, no schema changes made (test-account role elevation and the synthetic
  property/employee row used existing columns only — ordinary data writes, not schema changes).
- No SMS, Google Routes API, or AI blog writing touched.
- No broad responsive redesign performed — every other finding was documented, graded, and prioritized, not
  fixed.
- Technician mobile app: planning only, nothing built.
- `pnpm typecheck`, `pnpm test` (175/175), `pnpm build`, and `pnpm bundle:functions` all pass clean.

## Housekeeping / decisions needed from you

1. **Five `@test.com` accounts** were created in the production database to run this audit (customer,
   employee, customer_service-attempted, sales-attempted, admin — listed in
   `reports/mobile-audit/TEST_ACCOUNTS.json`). Recommend deleting them now that the audit's done — want me
   to do that, or keep them around for a future audit/QA pass?
2. **Playwright was added as a devDependency** (`package.json`/`pnpm-lock.yaml`) to run this audit. Keep it
   installed for future mobile-audit re-runs, or remove it now that this sprint is done?
3. The local dev server I started for this audit is still running in the background — I'll stop it once you
   confirm the above, since nothing else needs it.
4. Nothing was pushed or committed — this entire sprint's changes (the banner fix + the new `reports/
   mobile-audit/` deliverables + the `scripts/audit/` helper scripts + the Playwright devDependency) are
   sitting uncommitted in the working tree, same as every other change this session, awaiting your explicit
   go-ahead to commit/push.
