# Parcel Observability Report
**Date:** 2026-06-02

---

## Checkpoints Wired

All checkpoints are in `server/services/parcel/parcelLookupService.ts`.

| Checkpoint | When |
|-----------|------|
| `parcel.lookup.start` | `lookupParcel()` called |
| `parcel.cache.checked` | Before cache query |
| `parcel.cache.hit` | Cache result returned — includes county, durationMs |
| `parcel.cache.miss` | No cache hit |
| `parcel.county_lookup.disabled` | `ENABLE_PARCEL_COUNTY_LOOKUP=false` flag active |
| `parcel.county.detected` | County resolved from ZIP |
| `parcel.county.lookup.start` | County adapter `lookup()` called |
| `parcel.county.lookup.success` | Adapter returned acreage — includes acreage, confidence |
| `parcel.county.lookup.failed` | Adapter threw exception |
| `parcel.manual_review` | No result available — includes reason |

## Structured Log Events

| Event | Level | When |
|-------|-------|------|
| `parcel.lookup.started` | info | Flow entry |
| `parcel.lookup.cache_hit` | info | Cache hit with durationMs |
| `parcel.lookup.county_lookup_disabled` | warn | Feature flag prevents lookup |
| `parcel.lookup.county_failed` | error | Adapter exception |
| `parcel.lookup.manual_review` | info | No result — reason included |
| `parcel.lookup.county_success` | info | Successful result with confidence |

## Context Included in Logs

- `requestId` — links to the HTTP request
- `zip` — ZIP code looked up
- `county` — detected county
- `acreageSource` — where acreage came from
- `confidence` — parcel confidence score
- `cached` — true/false
- `durationMs` — total lookup time
- `reason` — why manual review was triggered

**Never logged:** raw parcel payload, owner info, customer PII beyond ZIP code.

---

## Feature Flags Applied

### `ENABLE_PARCEL_COUNTY_LOOKUP` (default: `true`)

When set to `false`:
- Cache hits still work (cache is checked before the flag gate)
- County lookup is skipped
- Returns `MANUAL_REVIEW_REQUIRED` immediately
- Logs `parcel.lookup.county_lookup_disabled`
- Checkpoint: `parcel.county_lookup.disabled`

This allows temporary disabling of county GIS without breaking cached results.

### `ENABLE_REGRID_FALLBACK` (default: `false`)

Enforced in **two places**:
1. `server/lib/featureFlags.ts` — `flags.regridFallback()` function
2. `server/services/parcel/adapters/RegridFallbackAdapter.ts` — checks both the feature flag AND `REGRID_API_KEY` presence

When `false`: Regrid adapter returns `null` immediately — no API call made.
When `true`: Regrid adapter proceeds (also requires `REGRID_API_KEY`).

---

## Fallback Visibility

The checkpoint system records which fallback path was taken:
- `parcel.fallback.used` — generic fallback
- `parcel.scag.fallback.used` — SCAG geometry used
- `parcel.regrid.fallback.used` — Regrid API used

These appear in the JSON log stream and can be filtered/aggregated to track fallback rates.
