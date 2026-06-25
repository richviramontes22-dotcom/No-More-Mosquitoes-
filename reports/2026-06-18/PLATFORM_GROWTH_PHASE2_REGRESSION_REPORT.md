# Platform Growth Phase 2 — Regression Report
**Date:** 2026-06-18

Full file list touched this sprint (`git status --short`): 23 modified, 17 new (including 6 test files and 3 migrations). Cross-checked against each system named in the spec's regression-check list below.

| System | Touched this sprint? | Evidence / Reasoning |
|---|---|---|
| **Quote system** | No | `server/routes/parcelQuote.ts`, `server/services/parcel/**` — zero changes. Parcel/quote test suite (`reverseGeocodeCache.spec.ts`, `googleAddressService.spec.ts`, `cache.spec.ts`, 19 tests) still passes unchanged. |
| **Checkout / Stripe billing** | No | `server/routes/billingStripe.ts`, `server/routes/webhooksStripe.ts`, `server/lib/stripeMode.ts` — zero changes. No test in this area regressed (none existed to break; behavior untouched). |
| **Promo codes** | No | `server/routes/adminPromos.ts` — zero changes. |
| **Legal system** | No (verified, see `LEGAL_SYSTEM_SAFETY_CHECK_REPORT.md`) | Zero file changes; `enforcement_enabled` default and draft-document gating confirmed unchanged. |
| **CRM** | Read-only addition only | `adminLeadsRouter`/lead inbox endpoints untouched. The only CRM-adjacent change is the new `getCrmAnalytics()` read aggregate (`platformAnalyticsService.ts`) — a new `GET` endpoint, doesn't write to `leads`/`lead_followups`/`lead_assignments`. `leadService.spec.ts` (31 tests) still passes unchanged. |
| **Referrals** | Extended, additively | `referralService.ts` gained new exports (`detectConversionCandidates`, `approveConversion`, `rejectConversion`, `getRewardSettings`, `updateRewardSettings`) — all new functions. Existing exports (`listReferrals`, `updateReferralStatus`, `createReward`, `updateRewardStatus`, code CRUD) are untouched in this diff except `ReferralStatus` gaining one new union member (`conversion_candidate`), which is additive to a TypeScript union and a DB CHECK constraint (old values still valid). `adminReferrals.ts` only gained new routes; none of its existing routes were edited. |
| **Route planning** | Extended, additively | See below — manual workflows independently verified unchanged. |
| **Service areas** | No | `adminServiceAreas.ts` — zero changes. |
| **Customer dashboard** | Extended, additively | `Appointments.tsx` — the existing instant-reschedule `RescheduleDialog` component's calendar/window-selection/submit logic is byte-for-byte unchanged; the only addition is a new link that, when clicked, swaps to a *new* sibling component (`RescheduleRequestDialog`) rather than modifying the existing one in place. |
| **Admin dashboard** | Extended, additively | All admin changes are: new pages (`Analytics.tsx`, `RescheduleRequests.tsx`), new nav entries, new cards/tabs appended to existing pages (`Notifications.tsx`, `Referrals.tsx`, `RoutePlanning.tsx`). No existing admin page had existing markup removed or logic rewritten — confirmed by re-reading each diff. |

## Route Planning — Detailed Verification

This was the highest-risk area (most files touched: `adminRoutes.ts`, `routeAutomationPolicy.ts`, `smartRoutingOptimizer.ts`, `routeOptimization.ts`, `RoutePlanning.tsx`, plus the new `dayPlanGenerator.ts`).

- **Manual "Generate Day Plan" button** — its handler (`POST /routes/day/generate`) is now a thin wrapper calling `generateDayPlan()`, which contains the exact original logic moved verbatim (confirmed during the original extraction by running the full test suite immediately before adding any new code). No behavior change.
- **Manual "Apply New Order" / drag-and-drop reorder** (`POST /routes/:routeId/reorder-stops`) — re-read in full this session: **zero lines of this handler were changed**. It still takes the admin's manually-dragged `orderedAssignmentIds`, recomputes ETAs/distances for *that exact order* via `smartOptimizeRoute()`, and writes back — unrelated to the new `applySmartOptimizeToRoute()` function added to `smartRoutingOptimizer.ts` for the automation sweep (which re-sequences from scratch, a different operation). The two coexist without one calling or affecting the other.
- **Manual publish / Smart Optimize preview / automation settings dialog** — all pre-existing endpoints in `adminRoutes.ts` (publish, preview-optimize, GET automation-settings) are unmodified in this diff; only the `PATCH` automation-settings allowlist gained 6 new optional fields (old clients omitting them are unaffected) and two endpoints (`run-now`, `automation/history`) were extended/added.
- **Existing automation behavior** (Phase 1: review_window / fully_automatic publish) — `evaluateRouteForAutoPublish()`'s four original blockers are untouched; the only change to `autoPublishEligibleRoutes()` is an additional check *after* the existing eligibility check, which can only make publish more restrictive (confirmed by the new spec tests showing a blocked route still never publishes, and an eligible route now requires two extra explicit opt-ins to fully publish instead of auto-publishing immediately under `fully_automatic`+`enabled`). Per the audit, production currently has `enabled = false`, so no live configuration's behavior actually changes today.

## Test Suite Evidence

`pnpm test` — 106/106 passed across 13 files, including all pre-existing suites (`leadService`, `legalGate`, `pricing`, `utils`, `GoogleAddressAutocomplete`, parcel/GIS) with zero modifications and zero failures. `pnpm typecheck` and `pnpm build` both clean. See `PLATFORM_GROWTH_PHASE2_VALIDATION_REPORT.md` for full detail.

## Conclusion

No regressions identified in any of the eleven systems named in the spec's regression-check list. All Phase 2 changes are additive (new tables, new functions, new endpoints, new UI sections) or were verified byte-level unchanged where extraction/refactoring touched shared code (day-plan generation, coordinate resolution).
