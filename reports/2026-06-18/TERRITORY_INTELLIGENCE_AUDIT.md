# Territory Intelligence — Data Source Audit
**Date:** 2026-06-18

All findings below are from direct, read-only queries against the production Supabase REST API (service-role key), not assumptions from migration files alone — migration history was cross-checked against actual live schema/data because this codebase has several "schema fixed up later" migrations (e.g. `service_areas` evolved from an array-of-zips model to one-row-per-ZIP without every step being obvious from the file names).

## Current Production Data Volumes (context for everything below)

| Table | Row count |
|---|---|
| `service_areas` | 1,035 (one row per ZIP) |
| `service_area_demand_events` | 0 |
| `leads` | 4 |
| `appointments` | 9 |
| `subscriptions` | 6 |
| `properties` | 13 |
| `payments` | 2 |
| `referrals` | 0 |
| `routes` | 0 |

**This is a near-empty production dataset.** Whatever gets built must degrade gracefully to "no data yet" rather than erroring — this is the single most important constraint for Phase 4/6's implementation and tests.

## What demand data exists by state/county/ZIP?

`service_area_demand_events` (`zip`, `event_type`: `out_of_area_quote` | `waitlist_signup`, `lead_id`, `email`, `name`, `created_at`) is purpose-built for this — but currently has **0 rows in production**. It's written by the quote flow whenever a ZIP isn't covered. `leads` also carries `service_zip`/`service_county`/`service_state`/`service_area_status` (`covered`/`not_covered`/`unknown`) directly on each lead row, but every one of the 4 live leads has these fields `null` (they predate the column being added, or weren't populated by whichever code path created them) — `leads.zip` (the raw, non-normalized field) is populated on all 4, so that's the usable demand signal today.

## What in-area vs out-of-area data exists?

`leads.service_area_status` is the designed signal (`covered`/`not_covered`/`unknown`) but unpopulated in the current data. The reliable way to derive in-area/out-of-area *today* is to compare a lead's/property's ZIP against the `service_areas` table (1,035 ZIPs, each with `is_active`) — if the ZIP isn't in the table, or is in the table with `is_active = false`, it's out-of-area. `service_area_demand_events.event_type = 'out_of_area_quote'` is the explicit out-of-area signal going forward, just empty right now.

## What conversion data exists by ZIP/county?

Nothing pre-aggregated. It's derivable by joining `leads.zip` → `leads.converted_customer_id`/`subscription_id` (both present as columns; both `null` on all 4 current leads) and `leads.status`. `referrals` also has a `lead_id` → conversion path (per the Phase 2 sprint's `conversion_candidate` work) but the table is empty in production. **Conversion rate by ZIP is calculable as a formula, but with 4 leads and 0 referrals there's nothing to show yet** — the UI needs an explicit "not enough data" state, not a 0% that reads as a bad signal.

## What revenue data exists by ZIP/county?

Two candidate sources:
- **`subscriptions`** — has `amount_cents` *and* `property_id` directly on each row. This is the cleanest source: join `subscriptions.property_id` → `properties.zip`, sum `amount_cents` where `status = 'active'`. **This is what was used for the "estimated revenue" column.**
- **`payments`** — has `amount_cents` and `status` but only `user_id`, no `property_id`. A user can own multiple properties, so attributing a payment to one ZIP would require guessing which property it was for. Not used for per-ZIP revenue; flagged as a known gap below.
- `invoices` exists as a table but has **0 rows** in production — not usable at all right now.

Revenue-by-ZIP is therefore an **estimate from active recurring subscription value**, not actual collected revenue. This is stated explicitly in the UI, not presented as exact.

## What technician capacity data exists by ZIP/county?

`employees.service_area_ids` (array) is the intended link, plus `technician_capacity_profiles` (home base, max stops/drive minutes). **Both are effectively empty in production**: there is exactly one `employees` row, and it's a test fixture (`worker_type: "test"`, `is_test: true`, `service_area_ids: []`). Zero real technicians, zero capacity profiles. No technician-by-ZIP coverage data exists yet — this is a hard gap, not a query problem.

## What is missing?

1. **`service_area_demand_events` is unused so far** — the table exists and is well-designed, but nothing has written to it yet, so "demand for uncovered ZIPs" is currently always zero in practice, regardless of real demand.
2. **`leads.service_area_status`/`service_zip`/`service_county` are unpopulated** — the raw `leads.zip` still works as a fallback, but ZIP needs to be matched against `service_areas` to know in/out-of-area and to get county, rather than trusting a pre-computed field.
3. **ZIP format inconsistency** — `properties.zip` sometimes contains ZIP+4 (e.g. `"92653-1143"`) while `service_areas.zip` is plain 5-digit. Any join must normalize to the first 5 characters or it will silently fail to match.
4. **No technician-capacity-by-territory data at all** — zero real employees, zero capacity profiles in production today. The "technician capacity by ZIP/county" column in the spec's ZIP table can only be populated once real technicians and `service_area_ids` exist; until then, it should read as "no coverage data" rather than 0 (0 implies measured-and-zero, not unmeasured).
5. **Revenue is recurring-subscription-only**, not true collected revenue (no usable `invoices`, and `payments` can't be attributed to a single property). Acceptable as an "estimate," not exact.
6. **Production has essentially no real customer/lead/appointment volume yet** (single digits across the board). Territory Intelligence will be correct but visually sparse in production today — this is a data problem, not an implementation problem, and is exactly why every score/aggregation must have an explicit empty-state, not just a working-but-empty table.
