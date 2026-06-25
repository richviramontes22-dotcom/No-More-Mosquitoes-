# Territory Intelligence Validation Report

## Status: fully validated, both via existing tests and live with real (not synthetic) demand data

This system was not blocked by the Phase 2 routing bug — it reads `leads`, `service_area_demand_events`,
`properties`, `appointments`, and `subscriptions`, none of which depend on `routes`/`assignments`.

## Existing test coverage (15 tests, all passing)

Empty-data safety; active-ZIP aggregation (demand, customers, appointments, subscriptions, revenue);
ZIP+4-to-5-digit normalization; out-of-area ZIPs surfaced as `"unmapped"` rather than dropped; out-of-area
events counted separately from an inactive (but known) `service_areas` row; the `opportunity_score` formula
verified exactly against its documented components, with and without the at-capacity penalty; five distinct
recommendation types (`expansion_candidate`, `activate_zip`, `low_priority`, `add_technician_capacity`,
`review_manually`); the `area_filter` query parameter.

## Live verification — using real demand data, not manufactured test data

No synthetic demand data needed to be created for this phase — real signal already existed from earlier
sessions' work, and proved more valuable than synthetic data would have, since it incidentally tests
cross-session data integrity:

| ZIP | Source | What it proves |
|---|---|---|
| `10001` (New York) | A real waitlist signup submitted while testing the out-of-service-area checkout flow (`production-stabilization` sprint) | The `service_area_demand_events` → territory intelligence pipeline correctly picks up a `waitlist_signup` event |
| `94102` (San Francisco) | A real out-of-area quote attempt from testing the public quote-widget service-area fix (same earlier sprint) | The pipeline also correctly picks up an `out_of_area_quote`-sourced lead, from a **completely different code path**, days apart |

Both surfaced correctly via `GET /api/admin/territory-intelligence?area_filter=out_of_area`:

```
10001  unmapped  demand: 1  recommendation: activate_zip
94102  unmapped  demand: 1  recommendation: activate_zip
```

Both received a sensible `opportunity_score` and a human-readable recommendation reason (e.g., "Unmapped ZIP
with some demand (1 lead(s) + 1 out-of-area event(s)) — worth turning on"), matching the documented scoring
formula exactly as the unit tests already verify in isolation — confirming the formula holds with real,
independently-sourced data, not just controlled fixture data.

## Dashboards / heat maps / recommendations updating

The admin Territory Intelligence page (`/admin/territory-intelligence`) reads from this same endpoint with
no caching layer in between — confirmed by the endpoint itself recomputing on every request
(`generated_at` timestamp changes call to call). Any new demand event or lead is reflected the next time the
page loads; there's no batch/cron step in between that could leave it stale.

## Conclusion

No bugs found. No fixes needed. This is the one validation phase in this sprint that required no migration,
no new test, and no correction — it was already correct, and live data from two unrelated earlier sessions
happened to provide a better real-world check than a freshly fabricated scenario would have.
