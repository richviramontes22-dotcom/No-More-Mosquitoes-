# Platform Growth Phase 1 — Validation Report
**Date:** 2026-06-17

## Commands Run

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ Pass — 0 errors (run repeatedly after each major piece: routing automation, referrals, CRM Phase 3, UI integration — never broke) |
| `pnpm test` | ✅ Pass — 7 test files, 68 tests, 0 failures |
| `pnpm build` | ✅ Pass — `build:client` + `build:server`, same pre-existing chunk-size/dynamic-import warnings, no new errors |
| `pnpm bundle:functions` | ✅ Pass — confirms the new `auto-publish-routes` scheduled function (which imports `server/services/routing/routeAutomationPolicy.ts`) bundles correctly with esbuild, same as the four pre-existing scheduled functions |

## Functional Checks (by code path, no live database available in this environment)

### Routing Automation
- Default settings (`enabled: false`, `mode: 'manual_only'`) cause `autoPublishEligibleRoutes()` to return immediately with zero DB writes — confirmed by reading the function: the very first check is `if (!settings.enabled || settings.mode === "manual_only") return { checked: 0, ... }`.
- `evaluateRouteForAutoPublish()` rejects `completed`/`canceled`/`in_progress`/`published` routes unconditionally, before any settings-based check runs.
- Every branch that mutates a route (`auto_approved`, `auto_published`) or declines to (`blocked`) calls `logAutomationDecision()`, which writes to `route_audit_log` — there is no code path that changes route status without a corresponding audit row.

### Referral Program
- `validateReferralCode()` and `attributeReferral()` never throw on invalid/missing codes — they return `{ valid: false }` / `null` respectively, and the one call site (`schedule.ts`) wraps the attribution call in `.catch()` on top of that, so a bad referral code cannot fail a booking.
- The unique partial index `referrals_one_per_lead` (DB-level) plus the `23505`-error-is-not-an-error handling in `attributeReferral()` together prevent a lead from being attributed to two different codes, including under concurrent requests.
- `createPartnerReferralCode()` and `getOrCreateCustomerReferralCode()` both retry on a `code` unique-constraint collision (the latter up to 5 times) rather than failing outright.

### CRM Phase 3
- Route-ordering bug caught and fixed during implementation: `GET /leads/staff` and `GET /leads/followups` had to be moved before `GET /leads/:id` in `adminLeads.ts`, or Express would have matched `:id = "staff"` / `:id = "followups"` first. Verified by reading the final file — both specific routes now precede the parametric one.
- The one pre-existing test that would have broken from the additive `LeadDetail` shape change (`linked.referral`) was identified and updated *before* running the suite, not discovered by a failing run.

## Files Changed/Added This Sprint (full list)

**Migrations:** `2026-06-17_route_automation_settings.sql`, `2026-06-17_referral_program.sql`, `2026-06-17_crm_phase3_lead_assignment_followups.sql`

**Server:** `services/routing/routeAutomationPolicy.ts`, `services/referrals/referralService.ts`, `routes/adminReferrals.ts`, `routes/adminRoutes.ts` (automation endpoints), `routes/adminLeads.ts` (assignment/followup/staff endpoints), `services/leads/leadService.ts` (additive), `routes/schedule.ts` (referral attribution hook), `index.ts` (router registration), `shared/api.ts` (referralCode field)

**Netlify:** `netlify/functions/auto-publish-routes.ts`, `netlify.toml` (new scheduled function entry)

**Client:** `pages/admin/RoutePlanning.tsx` (automation settings dialog), `pages/admin/Referrals.tsx` (new page), `pages/admin/Leads.tsx` (assigned column), `pages/admin/LeadDetail.tsx` (assignment + follow-ups + referral badge), `pages/dashboard/Profile.tsx` (Refer & Earn card), `lib/referralCapture.ts` (new), `lib/adminApi.ts` (untouched this sprint — already extended last sprint), `hooks/admin/useAdminLeads.ts` (additive), `components/schedule/ScheduleDialog.tsx` (referral forwarding), `App.tsx` (capture call + route + nav), `pages/admin/AdminLayout.tsx` (nav entry)

**Tests:** `server/services/leads/leadService.spec.ts` (one assertion updated for the additive shape change)
