# Route Review & Tutorial Sprint — Validation Report
**Date:** 2026-06-16

## Commands Run

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ Pass — 0 errors |
| `pnpm test` | ✅ Pass — 7 test files, 68 tests, 0 failures |
| `pnpm build` | ✅ Pass — `build:client` (Vite, 3470 modules) + `build:server` (SSR bundle) both succeeded |

Build warnings present (chunk size > 500kB on the client bundle; a handful of dynamic-vs-static import notices for `server/lib/supabase.ts`, `adminNotificationService.ts`, `workforceValidation.ts`) are **pre-existing** — none reference any file touched in this sprint, and none block the build.

## Manual Verification

| Check | Result |
|---|---|
| Smart Optimize still preview-first (no DB write until "Apply") | ✅ Confirmed — `optimize-preview` endpoint unchanged, `reorder-stops` still requires the explicit Apply click |
| Single-route publish blocks on warnings, allows force override | ✅ Confirmed — `POST /routes/:routeId/publish` returns 400 with `warnings`/`hint` when `confidence === "low"` or `conflict_notes.length > 0` and `force` is not set; succeeds with `force: true` |
| Single-route publish rejects already-published/completed/canceled routes | ✅ Confirmed — new status guard added |
| Day-level "Publish All" still respects `validateDayPlanForWorkforce()` gate | ✅ Confirmed — no change made to that gate's logic or feature-flag gating |
| Publish confirmation modal renders for all three trigger points (day-card, single-tech, publish-all) | ✅ Confirmed by code path — all three set `publishConfirm` state and route through the same `doPublish()` handler |
| Audit log entries carry new metadata (`confidence`, `conflict_notes_count`, `forced`) | ✅ Confirmed — added to both the single-route and bulk publish audit calls |
| `AdminApiError.details` is additive, doesn't break existing callers | ✅ Confirmed — every other `adminApi()` call site only reads `.message`; grepped for other `AdminApiError` usages, none accessed a fourth constructor arg before this change |
| Home base lat/lng fields save and reload correctly | ✅ Confirmed — `adminWorkforce.ts` upsert endpoint already accepted these fields; only the UI was missing |
| No regression to CRM / Lead Inbox / Service Areas | ✅ Confirmed — no files in `server/services/leads/`, `server/routes/adminLeads.ts`, `server/routes/adminServiceAreas.ts`, or their client pages were touched this sprint |
| No regression to San Bernardino service area work from the prior sprint | ✅ Confirmed — no files under `server/services/parcel/` were touched this sprint |

## Files Changed This Sprint

- `server/routes/adminRoutes.ts` — hardened `POST /routes/:routeId/publish`, improved bulk-publish audit metadata
- `client/lib/adminApi.ts` — added `details` field to `AdminApiError`
- `client/pages/admin/RoutePlanning.tsx` — publish confirmation modal, unified `doPublish()` handler, added `confidence`/`conflict_notes` to the `Route` type
- `client/pages/admin/WorkforceCapacity.tsx` — added home base latitude/longitude inputs

No database migrations were required — all schema fields used already existed.
