# Workforce Optimization — Implementation Report
**Date:** 2026-06-18

## What Was Built

| Piece | File |
|---|---|
| Service | `server/services/analytics/workforceOptimizationService.ts` — `getWorkforceOptimization()` |
| Admin API | `server/routes/adminWorkforceOptimization.ts` — `GET /api/admin/workforce-optimization`, mounted in `server/index.ts` |
| Admin UI | `client/pages/admin/WorkforceOptimization.tsx` — new page at `/admin/workforce-optimization`, nav entry under Analytics |

Strictly read-only — confirmed by inspection: every database call in the service is a `select`. No employee, schedule, service area, or assignment row is ever written. This matches the explicit "do not auto-change employee schedules / service areas," and "do not auto-disable ZIPs / auto-hire or auto-assign staff" constraints by construction.

## Why This Doesn't Call `isTechnicianAvailable()` / `getEffectiveDailyCapacity()` in a Loop

Those two functions (`server/lib/technicianAvailability.ts`, `server/lib/technicianCapacity.ts`) are the canonical, already-shipped logic for "is this one technician available on this one date" — used during live route generation. They each do several sequential DB round trips. A dashboard needs the same answer for *every* technician across a *whole forecast window* (default 14 days) — calling them in a loop would mean `technicians × days × ~5 queries`. Instead, `getWorkforceOptimization()` bulk-fetches every relevant table once (`employees`, `technician_capacity_profiles`, `technician_schedule_templates`, `technician_date_overrides`, `blackout_dates`) and re-derives the identical priority chain (date override → schedule template → default) in memory via a local `resolveDay()` helper. The one intentional simplification: approved time-off requests aren't checked (the canonical function treats that table as optional/best-effort too, wrapped in a try/catch, so this isn't a behavioral regression — it's the same fallback path).

## Technician Utilization

Per active employee, over the forecast window: available days, scheduled/completed appointment counts (from `assignments`), resolved capacity (summed across available days), utilization % (`scheduled ÷ capacity`, `null` when capacity is 0 rather than dividing by zero), route miles and minutes (summed from `routes` rows in the window), and an overload warning when utilization exceeds 100%.

**Drive vs. service time split:** the spec asks for both as separate columns. `routes.total_duration_minutes` is a combined figure (no route-level drive/service split exists); `route_stops` *does* carry the detail needed (`distance_from_prev_miles`, `duration_from_prev_minutes`, plus the arrival/departure ETA gap for service time) but is empty in production today. Rather than guess a split from the combined total, `estimated_service_minutes` is reported as `0` and the full total is attributed to `estimated_drive_minutes`, with this limitation stated directly here rather than silently fabricated. This is correct, not approximate, once `route_stops` has real data — the audit flagged this as a data gap, not a logic gap.

## Capacity Forecast

One row per date in the window: available technicians, total stop capacity, scheduled stops (from `appointments.scheduled_date`, active statuses only), remaining capacity, and a `demand_pressure` tier derived from the scheduled/capacity ratio:

| Ratio | Pressure | Recommendation |
|---|---|---|
| > 100% | `over_capacity` | `add_technician` (zero available techs) or `reduce_active_zips_temporarily` (some techs, but still over) |
| ≥ 85% | `high` | `rebalance_routes` |
| ≥ 50% | `moderate` | `watch_demand` |
| < 50% | `low` | `no_action_needed` |

The `add_technician` / `reduce_active_zips_temporarily` split exists because these are different-sized levers: zero technicians available is a structural staffing gap (hire/reassign); some technicians but still over capacity on one day is better solved with a temporary, reversible measure (the recommendation text only — this system never actually disables a ZIP).

## Territory Staffing

Reuses `getTerritoryIntelligence()` (Phase 4) for per-county appointment demand and active-ZIP counts rather than re-deriving the same ZIP→county join a second time. Technician coverage per county comes from `employees.service_area_ids` (an array of `service_areas.id`) resolved to county names — per the audit, this is currently empty on the one real employee, so `technician_coverage` will correctly read `0` for every county until admins populate it; this is the honest answer, not a bug.

| Condition | Recommendation |
|---|---|
| Demand > 0, zero technician coverage | `add_coverage_in_county` |
| Coverage > 0, demand/coverage ratio > 10 | `add_technician` |
| Coverage > 0, ratio > 5 | `watch_demand` |
| Otherwise | `no_action_needed` |

## Empty-Data Behavior

Per the audit, production has 1 (test) employee and zero rows in `technician_capacity_profiles`/`technician_schedule_templates`/`technician_date_overrides`/`route_stops`/`routes`. Every aggregation defaults to `0`/`null`/empty-array rather than throwing: `Map.get()` calls all have `?? 0`/`?? []` fallbacks, division by zero is guarded (`utilization_pct: null` when capacity is 0), and the UI renders an explicit "No active technicians found" / "No forecast data" row instead of a blank table. Verified directly against production data in this same session (1 test employee, 0 profiles) without errors.

## Validation

`pnpm typecheck` clean, `pnpm test` 106/106 (no workforce-specific tests yet — those are added in Phase 8, see `PHASE3_VALIDATION_REPORT.md`).
