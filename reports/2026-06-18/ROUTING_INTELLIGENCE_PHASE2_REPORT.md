# Routing Intelligence Phase 2 — Implementation Report
**Date:** 2026-06-18

## What Was Built

| Piece | File |
|---|---|
| Schema | `db/migrations/2026-06-18_route_automation_phase2.sql` — 6 new columns on `route_automation_settings` |
| Refactor (prerequisite) | `server/services/routing/dayPlanGenerator.ts` (new) — extracted day-plan generation; `server/services/routing/smartRoutingOptimizer.ts` — added `applySmartOptimizeToRoute()`; `server/lib/routeOptimization.ts` — added `resolveCoordinates`/`calculateConfidence`/`mockGeocodeAddress` |
| Automation logic | `server/services/routing/routeAutomationPolicy.ts` — new `autoGenerateAndOptimizeDayPlans()`, extended publish gating |
| Admin API | `GET .../automation/history`, extended `PATCH .../automation-settings`, extended `POST .../automation/run-now` |
| Admin UI | `client/pages/admin/RoutePlanning.tsx` — Generation & Optimization card, Full Auto-Publish Gates card, Run Automation Now button, History view |
| Scheduled job | `netlify/functions/auto-publish-routes.ts` — now also calls `autoGenerateAndOptimizeDayPlans()` |

## Required Refactor: Extracting Day-Plan Generation

Phase 1 deliberately kept automation scoped to publish-stage decisions only, because the actual generation logic (~280 lines: blackout check, technician availability/capacity, ZIP grouping, round-robin assignment, coordinate resolution, route+stop creation) lived inline inside `POST /api/admin/routes/day/generate`'s Express handler — not callable from anywhere else. Building "auto-generate" for Phase 2 required either duplicating that logic (rejected — duplicated logic drifts and is exactly how routing bugs get reintroduced) or extracting it.

**What was extracted, verbatim:** the handler body moved into `generateDayPlan(date, { actorId, actorRole })` in a new `dayPlanGenerator.ts`. The route handler is now a 15-line wrapper that calls this function and translates its result to HTTP responses. `resolveCoordinates`/`calculateConfidence`/`mockGeocodeAddress` (previously private to `adminRoutes.ts`) moved to `server/lib/routeOptimization.ts` (the existing shared routing-math home) so both the route handler and the new generator import the same implementation rather than two copies. Confirmed safe by running the full test suite and `pnpm typecheck` immediately after the refactor, before adding a single line of new Phase 2 logic — the manual "Generate Day Plan" button behaves identically to before.

The same pattern was applied to Smart Optimize: `applySmartOptimizeToRoute(routeId, actorId, actorRole)` was extracted from `POST /routes/:routeId/reorder-stops` into `smartRoutingOptimizer.ts`, so auto-optimize calls the exact same fetch-stops → run algorithm → write-back logic a manual "Apply New Order" click does.

## New Automation Capabilities

### Auto-generate (`auto_generate_enabled`, default `false`)
When true, the 15-minute scheduled sweep calls `generateDayPlan()` for today and tomorrow, gated by two additional optional restrictions:
- `auto_generate_time` — don't run before this time of day.
- `auto_generate_days` — restrict to specific weekdays (empty/null = every day).

Generated routes land in `draft`, exactly like a manual click — auto-generate **never** touches publish status itself.

### Auto-optimize (`auto_optimize_enabled`, default `false`)
Independent toggle. When true, every route freshly created by an auto-generate pass is immediately run through `applySmartOptimizeToRoute()`. Routes generated manually are unaffected — this only fires on routes the *same automation pass* just created.

### Full Auto-Publish Gates
Two new, independent flags sit on top of the existing `mode`/`enabled` (Phase 1) settings:

| Flag | Default | Effect |
|---|---|---|
| `require_admin_review_before_publish` | `true` | When true, `autoPublishEligibleRoutes()` will still auto-*approve* an eligible draft, but stops there — it does not transition to `published`. |
| `allow_full_auto_publish` | `false` | Must ALSO be true (with the above false) for the publish step to ever run automatically. |

**Important, deliberate behavior change:** in Phase 1, an admin who set `mode='fully_automatic'` + `enabled=true` got full auto-publish with no further opt-in. Phase 2 adds a stricter requirement on top: that admin must now *also* explicitly set `require_admin_review_before_publish=false` and `allow_full_auto_publish=true` for publishing to resume automatically — otherwise routes stop at `approved`. This is a one-directional tightening (can only make existing configurations safer, never less safe), consistent with "Fully automatic mode must require explicit admin opt-in." Confirmed via direct database check that `enabled=false` in production today, so no live configuration is affected by this change.

## Hard Blockers — Unchanged

`evaluateRouteForAutoPublish()` was not modified in this sprint beyond the new two-flag gate added after its existing eligibility check runs. Every Phase 1 blocker (terminal/active status, low confidence, mock geo, drive-cap exceeded, Smart-Optimize-required) still applies exactly as before — the new flags can only make publish *more* restrictive, never bypass an existing blocker.

## Audit Logging

Every new decision point writes to `route_audit_log` with `actor_role: "system"`:
- `automation_route_generated` (per route, on auto-generate)
- `automation_smart_reorder` (per route, on auto-optimize)
- `approved_pending_admin_publish` (new — when a route clears eligibility but the full-auto-publish gates aren't both set)
- Existing `automation_blocked`/`automation_auto_approved`/`automation_auto_published` unchanged

The new admin-facing "View History" panel in Route Planning queries exactly this (`actor_role = 'system'`, most recent first) — no separate logging system was built.

## Validation

`pnpm typecheck` and `pnpm test` (72/72) run clean after each major step of this phase (refactor, then new logic, then UI) — not just once at the end, to catch any regression at the point it was introduced rather than after the fact.
