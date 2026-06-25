# Platform Growth Phase 1 — Regression Report
**Date:** 2026-06-17

## Routing (prior sprint: Route Review Workflow + Smart Optimizer)

| Check | Result |
|---|---|
| `POST /routes/:routeId/publish` warning-block logic (added last sprint) | ✅ Untouched — no edits to this function body this sprint |
| Publish confirmation modal, `doPublish()`, `AdminApiError.details` | ✅ Untouched |
| Smart Optimize preview/apply flow | ✅ Untouched |
| Day Planner generate/approve/publish-all buttons | ✅ Untouched — only a new "Automation Settings" button was added alongside them, no existing handler was modified |
| `route_audit_log` schema/usage | ✅ Unchanged — new automation decisions use the same table with `actor_role: "system"`, no migration altered its columns |

## CRM (Phase 1 + Phase 2)

| Check | Result |
|---|---|
| `upsertLeadFromQuote`, `upsertLeadFromManualReview`, `upsertLeadFromScheduleRequest`, `upsertLeadFromOutOfArea`, `upsertLeadFromWaitlist` | ✅ Untouched — zero edits to any upsert function body |
| `updateLeadStatus`, `addLeadNote` | ✅ Untouched |
| `GET/PATCH /api/admin/leads/:id`, `POST /api/admin/leads/:id/notes` | ✅ Untouched — new routes were added alongside, not in place of, these |
| Lead Inbox filters/search/pagination (`Leads.tsx`) | ✅ Untouched — only one new column added |
| `leadService.spec.ts` | ✅ 31/31 pass — one assertion intentionally updated for the additive `LeadDetail` shape (documented in `CRM_PHASE3_FOUNDATION_REPORT.md`), not a behavior change |

## Stripe Billing

| Check | Result |
|---|---|
| `server/routes/billingStripe.ts` | ✅ Not opened or edited this sprint |
| `server/routes/webhooksStripe.ts` | ✅ Not opened or edited this sprint — confirmed deliberately out of scope in `REFERRAL_PROGRAM_DESIGN_REPORT.md` (no automatic conversion-from-webhook hook was built) |
| `server/routes/marketplaceStripe.ts` | ✅ Not touched |

## Promo Codes

| Check | Result |
|---|---|
| `server/routes/adminPromos.ts` | ✅ Not touched this sprint (fixed in the prior session, untouched here) |
| `client/pages/admin/Promos.tsx` | ✅ Not touched |
| Promo validate/checkout integration | ✅ Not touched |

## Service Areas

| Check | Result |
|---|---|
| `server/routes/adminServiceAreas.ts`, `client/pages/admin/ServiceAreas.tsx` | ✅ Not touched |
| Parcel/quote lookup (`server/services/parcel/`) | ✅ Not touched |

## Cross-Cutting

| Check | Result |
|---|---|
| All RLS additions (`route_automation_settings`, `referral_codes`, `referrals`, `referral_rewards`, `lead_assignments`, `lead_followups`) follow the exact admin-only-`FOR ALL` pattern already in production for `leads`/`lead_notes`/`promo_codes` — no new RLS pattern was invented | ✅ Confirmed by reading each migration file side by side |
| Express route-ordering collisions | ✅ One found and fixed during implementation (`/leads/staff`, `/leads/followups` vs. `/leads/:id`) — verified no other new route introduces a similar single-segment collision with an existing `:id`/`:routeId` parametric route |
| `pnpm typecheck` / `pnpm test` / `pnpm build` / `pnpm bundle:functions` | ✅ All pass, see `PLATFORM_GROWTH_VALIDATION_REPORT.md` |

## Conclusion

No regressions found. Every change this sprint is additive (new tables, new functions, new routes, new UI sections/pages) — no existing function signature, route handler body, or migration was modified in a way that changes prior behavior, with the single documented exception of one test assertion updated to match an intentional, additive type-shape extension.
