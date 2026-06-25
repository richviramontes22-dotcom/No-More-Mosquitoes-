# Territory Intelligence — Implementation Report
**Date:** 2026-06-18

## What Was Built

| Piece | File |
|---|---|
| Service | `server/services/analytics/territoryIntelligenceService.ts` — `getTerritoryIntelligence()` |
| Admin API | `server/routes/adminTerritoryIntelligence.ts` — `GET /api/admin/territory-intelligence`, mounted in `server/index.ts` |
| Admin UI | `client/pages/admin/TerritoryIntelligence.tsx` — new page at `/admin/territory-intelligence`, nav entry under Analytics |

Strictly read-only: the service issues `select` queries only against `service_areas`, `leads`, `service_area_demand_events`, `properties`, `appointments`, `subscriptions`. There is no `insert`/`update`/`delete` anywhere in the file — it cannot activate a ZIP, change capacity, or touch a service area, by construction, not just by convention.

## How ZIPs Are Joined Across Tables

Per the audit's findings, `service_areas` (1,035 rows, one per ZIP) is the only table with city/county/state, so it's the hub: every other table's raw ZIP value is normalized (first 5 characters, to handle the ZIP+4 values found on some `properties` rows) and matched against it. A ZIP with real signal (a lead, an out-of-area event) but no `service_areas` row at all is still surfaced with `service_status: "unmapped"` rather than silently dropped — an unmapped ZIP with strong demand is exactly the "expansion_candidate" case the spec asks for.

## Scoring

Exactly the formula given, computed per ZIP:

```
opportunity_score =
  demand_count * 3
  + out_of_area_count * 4
  + customer_count * 5
  + appointment_count * 2
  + subscription_count * 8
  - penalty
```

`penalty` is one flat value (10 or 5) applied for exactly one of two simple, named conditions — never a black box:
- **10** — active ZIP already at/over its stated `capacity` (less remaining opportunity to grow there; this is a "needs more technicians," not "grow this ZIP" case)
- **5** — inactive/unmapped ZIP with zero demand and zero out-of-area signal (nothing to suggest activating it)

Every row's `score_breakdown` field exposes each component (`demand_component`, `out_of_area_component`, `customer_component`, `appointment_component`, `subscription_component`, `penalty`, `penalty_reason`) individually, and every recommendation carries a `recommendation_reason` string — nothing is a bare score or a label without an explanation, per the explicit "every score should include explanation fields" requirement.

## Recommendation Logic

| ZIP state | Rule | Recommendation |
|---|---|---|
| Inactive/unmapped | demand + out-of-area signal ≥ 3 | `expansion_candidate` |
| Inactive/unmapped | demand + out-of-area signal ≥ 1 | `activate_zip` |
| Inactive/unmapped | no signal at all | `low_priority` |
| Active | at/over capacity | `add_technician_capacity` |
| Active | ≥75% of capacity | `watchlist` |
| Active | zero activity of any kind | `review_manually` |
| Active | normal activity, room to grow | `watchlist` |

County rows roll up the same six numbers (summed across their ZIPs) and apply an analogous, coarser rule set (e.g., any ZIP needing capacity in the county → county-level `add_technician_capacity`; ≥2 inactive/unmapped ZIPs with demand → `expansion_candidate`).

## Conversion Rate — Explicit "Not Enough Data" Handling

Per the audit's finding that production has only 4 leads total, `conversion_rate` is `null` (rendered as "—" in the UI) unless a ZIP has at least 3 leads recorded. A 0% or 100% conversion rate computed from 1 lead would be misleading, not informative — this threshold exists specifically to avoid that.

## Revenue — Explicitly an Estimate

`estimated_revenue_cents` sums `subscriptions.amount_cents` where `status = 'active'`, joined via `subscriptions.property_id` → `properties.zip`. Per the audit, this is the only clean revenue-by-property signal in the schema today (`payments` has no `property_id`; `invoices` is empty). The UI labels this column "Est. Revenue," not "Revenue," to avoid overstating precision.

## Filters

`state`, `county`, `service_status` (`active`/`inactive`/`unmapped`), `area_filter` (`in_area`/`out_of_area`), and an optional date range — the date range applies only to the time-bound signals (demand, out-of-area events, appointments), not to customer/subscription/revenue figures, which reflect current state. This distinction is stated directly in the API response (`data_window_note`) and is necessary because "how many active subscribers does this ZIP have right now" isn't a question a date range can meaningfully answer.

## UI

Two tables (county rollup, ZIP detail) plus a filter bar — no new charting introduced, consistent with "stat cards and tables, no heavy charts." The ZIP table caps the rendered rows at 200 (sorted by opportunity score, so the most actionable rows are always visible) with a note when more exist, since `service_areas` alone is 1,035 rows.

## Known Limitation (carried over from the audit, not something this implementation can fix)

Production currently has single-digit lead/appointment/subscription counts and zero `referrals`/`service_area_demand_events` rows. The page is fully functional today but will look sparse — that's a data reality, not a bug. Verified via the empty-data-safety tests in Phase 8.
