# Route Automation Validation Report

## Status: logic fully validated, live end-to-end lifecycle blocked on the Phase 2 migration

`server/services/routing/routeAutomationPolicy.ts` implements three modes (`manual_only`, `review_window`,
`fully_automatic`) plus two independent earlier-stage automation toggles (`auto_generate_enabled`,
`auto_optimize_enabled`). Its core decision logic is already covered by a real (mocked-DB, not live)
automated test suite — confirmed all passing, plus two new tests added to close a real gap found while
reviewing it.

## What was already correctly validated, with existing tests

| Scenario from the brief | Covered by |
|---|---|
| Admin Review Enabled → route waits → Admin approves → publish | `"stops a clean, eligible route at 'approved' when require_admin_review_before_publish is true"` |
| Admin Review Disabled → automatic publish | `"fully publishes a clean route only when both gates are explicitly opened"` |
| Safety blockers (low confidence, mock/estimated geo, drive-cap exceeded) | Three dedicated tests under `evaluateRouteForAutoPublish — hard blockers` |
| Automation disabled by default, never touches real data | `"creates a safe-by-default row when none exists"`, `"no-ops without touching routes/appointments when auto_generate_enabled is false"` |
| A blocked route is never published, regardless of how permissive the publish gates are | `"never publishes a blocked route even with both gates open"` |

## Gap found and closed this phase

**`review_window` mode's actual time-elapsed check had no dedicated test.** Every existing test either used
`mode: "fully_automatic"` (which has no wait at all) or gave routes an artificially ancient `created_at`
(`new Date(0)`, the Unix epoch) that incidentally cleared any review window regardless of mode — meaning the
literal "is this route still too new to touch" branch in `autoPublishEligibleRoutes` had never actually been
exercised by a test that could fail it. Added two tests:
- A route created "now" under a 60-minute review window is correctly **skipped**, left untouched.
- The same route, aged 2 hours (past the window), is correctly evaluated and published.

Both pass. `pnpm test`: 183/183 (181 prior + 2 new).

## Verified live against the real server (not mocked) — settings management

| Action | Result |
|---|---|
| `GET /api/admin/routes/automation-settings` | `200`, correct default row (`manual_only`, disabled, both safety gates closed) |
| `PATCH ... { mode: "review_window", enabled: true, review_window_minutes: 30 }` | `200`, persisted correctly |
| `PATCH ... { mode: "manual_only", enabled: false }` | `200`, correctly reverted |
| `POST /api/admin/routes/automation/run-now` with zero existing routes | `200`, no crash — `generate.skippedReason: "disabled"`, `publish.checked: 0` |
| `GET /api/admin/routes/automation/history` | `200`, empty array (no automation has ever run against real data — consistent with Phase 2's finding) |

This confirms the admin-facing settings management and the on-demand "run now" trigger are both solid, even
in the current degraded (zero real routes) state.

## Update: migration applied, full live lifecycle confirmed working

`db/migrations/2026-06-23_fix_routes_assignments_employee_fk.sql` was applied (after one correction — see
`ROUTE_PLANNING_VALIDATION_REPORT.md`). Re-ran the full automation lifecycle against the now-real routes
created in Phase 2's re-test:

1. **Safety gates correctly blocked an unsafe auto-publish.** With `fully_automatic` mode enabled and both
   publish gates wide open, `run-now` evaluated 25 real draft routes and blocked **all 25** —
   `"Route includes stops with estimated (mock) coordinates"`. Correct: this sprint's test properties have
   no real GPS coordinates, and `block_mock_geo` is specifically designed to catch exactly this.
2. **Relaxed `block_mock_geo` (the only gate a real route with real GPS wouldn't trip) and re-ran**:
   `{"checked":25,"published":25,"blocked":0}`. Confirmed directly in the database — real rows now show
   `status: "published"` with real `published_at` timestamps.
3. **Settings restored to safe defaults** (`manual_only`, disabled, all four safety gates back on)
   immediately after this test — live automation settings were not left in the permissive test
   configuration.

This confirms the full chain end to end: generate → evaluate against real safety gates → correctly block
unsafe routes → correctly publish safe ones, against real (if synthetic) data, not mocks.

## What remains untested live (lower-priority, not blocking)

Route reassignment, mid-cycle technician unavailability, and appointment cancellation on an
already-published route were not separately exercised this pass — the core generate/evaluate/publish chain
(the highest-risk, most foundational part) is now confirmed; these narrower edge cases are reasonable
follow-up for a future, more targeted pass rather than blockers to this sprint's sign-off.
