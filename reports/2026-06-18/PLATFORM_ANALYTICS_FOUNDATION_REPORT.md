# Platform Analytics Foundation — Implementation Report
**Date:** 2026-06-18

## What Was Built

| Piece | File |
|---|---|
| Aggregation service | `server/services/analytics/platformAnalyticsService.ts` — `getReferralAnalytics()`, `getRouteAnalytics()`, `getCrmAnalytics()` |
| Admin API | `server/routes/adminMetrics.ts` — `GET /api/admin/metrics/platform-analytics?window_days=30` |
| Admin UI | `client/pages/admin/Analytics.tsx` (new page + nav entry "Analytics") |

Per the spec's explicit instruction ("Do not build complex charts unless existing charting is already available. Tables/cards are acceptable"), this ships as stat cards + tables only. Recharts is already a dependency (used in `Revenue.tsx`), but a chart wasn't introduced here — the three dashboards are counts/aggregates better suited to tables at this stage, and adding charts for foundation-level metrics would be the kind of premature polish the project's working conventions ask to avoid.

## Referral Analytics

- **Leads/conversions by code** — every `referral_codes` row joined against `referrals`, counting total leads and conversions (`status` in `converted`/`rewarded`) per code.
- **Pending rewards** — count and total `amount_cents` of `referral_rewards` rows with `status = 'pending'` — directly answers "how much reward liability is sitting unissued right now."
- **Partner performance** — the same by-code table filtered to `owner_type = 'partner'`.

## Route Analytics

Windowed (`window_days`, default 30) over `routes.date` and `route_audit_log.created_at`:
- Total routes, estimated miles, estimated drive minutes — straight sums over `routes.total_distance_miles`/`total_duration_minutes`.
- **Published-with-warnings** — routes with `status = 'published'` and a non-empty `conflict_notes` array (the mock-geo/low-confidence flags that already exist on every route).
- **Auto-generated / auto-published counts** — counted directly from `route_audit_log` actions (`automation_route_generated`, `auto_published` with `actor_role = 'system'`) added in this same sprint's Routing Intelligence Phase 2 work — so these counts will read zero until an admin actually enables that automation, which is the correct behavior.
- **Smart Optimize savings** — sums `distance_saved_miles`/`time_saved_minutes` out of the `metadata` JSON already written by both the manual `smart_reorder` action and the new `automation_smart_reorder` action.

## CRM Analytics

- **Leads by status** — straight group-by on `leads.status`.
- **Assigned leads by staff** — group-by on `leads.assigned_to`, resolved to staff name/email via `profiles`.
- **Overdue follow-ups** — count of `lead_followups` where `status = 'pending'` and `due_at` is in the past.
- **Conversion candidates** — count of `referrals` where `status = 'conversion_candidate'` (the new status from this sprint's Referral Automation Phase 2) — gives admins a number to glance at instead of having to open the Conversion Review tab to know if anything's waiting.

## Validation

`pnpm typecheck` and `pnpm test` (72/72) pass. The endpoint was not load-tested against production data volume — at current table sizes (foundation-stage) the in-memory aggregation in `platformAnalyticsService.ts` is fine; if `leads`/`referrals`/`routes` grow into the tens of thousands of rows, this should move to SQL-side aggregation (`group by` in Postgres) rather than fetching all rows and reducing in JS.
