# Quote Fix Implementation Report

**Date:** 2026-06-11/12
**Implements:** Option B from
[QUOTE_FIX_DECISION_MATRIX.md](./QUOTE_FIX_DECISION_MATRIX.md) (unit-suffix
geocoding fallback + oversized-acreage manual-entry panel).

---

## Summary of changes

| File | Change |
|---|---|
| `server/services/parcel/googleAddressService.ts` | Added exported `stripUnitSuffix(address)` helper + `UNIT_SUFFIX_RE`. |
| `server/services/parcel/parcelLookupService.ts` | Step 2 (geocoding): if the full address fails to geocode and it has a unit/apt/suite/`#` suffix, retry geocoding with that suffix stripped. |
| `server/routes/parcelQuote.ts` | Added `oversized` boolean to the JSON response (`acreage > 2.0`). |
| `client/hooks/use-property-lookup.ts` | Added `oversized?: boolean` to `ParcelQuoteResult`, passed through from `body.oversized`. |
| `client/components/sections/QuoteWidgetSection.tsx` | New `oversized` state; `handleSearch` sets it from `data.oversized`; new `handleOversizedPreset`/`handleOversizedProceed` handlers; Phase-2 ("plans") now branches — normal tiles when `!oversized`, a new "shared/multi-unit property" panel with 0.05/0.10/0.25-ac presets + free-entry when `oversized`. Address/ZIP edits reset `oversized` alongside `lookupFailed`. |
| `server/services/parcel/googleAddressService.spec.ts` | New — 7 unit tests for `stripUnitSuffix`. |

No changes to: county adapters, caching (`cache.ts`), feature flags, Regrid/SCAG code, database schema, `pricingQuote.ts`'s tier tables, or `AddressCheckerSection.tsx`/`AddPropertyDialog.tsx`.

---

## B1 — `stripUnitSuffix` + geocoding fallback

### `googleAddressService.ts`

```ts
// Matches a trailing unit/apartment/suite/building designator, e.g.
// ", Unit 31", " #31", " Apt 31", " Suite B" — with or without a leading comma.
const UNIT_SUFFIX_RE = /[\s,]+(?:#|unit|apt|apartment|suite|ste|bldg|building)\.?\s*#?\s*[a-z0-9][a-z0-9-]*\s*$/i;

export function stripUnitSuffix(address: string): { stripped: string; hadUnit: boolean } {
  const match = address.match(UNIT_SUFFIX_RE);
  if (!match) return { stripped: address, hadUnit: false };
  return { stripped: address.slice(0, match.index).trim(), hadUnit: true };
}
```

### `parcelLookupService.ts` (step 2, geocoding)

```ts
if (lat == null || lng == null) {
  let geo = await geocodeAddress(input.address, input.zip, input.city, input.state, 5000);

  // Free geocoders generally can't resolve unit/apt/suite-level US
  // addresses and return zero results. Retry with that suffix stripped so
  // the underlying building/parcel can still be located — the customer's
  // full entered address is preserved separately for their record.
  if (!geo) {
    const { stripped, hadUnit } = stripUnitSuffix(input.address);
    if (hadUnit) {
      geo = await geocodeAddress(stripped, input.zip, input.city, input.state, 5000);
    }
  }

  if (geo) {
    lat = geo.lat;
    lng = geo.lng;
    normalizedAddress = geo.normalizedAddress;
  }
}
```

**Behavior change:** addresses A/C1/C2/C3 (`Unit 31`, `#31`, `Apt 31`, `Unit
31` no comma) now geocode successfully via the second attempt (matching
address B's coordinates/parcel: `acreage = 21.057`, `apn = 588-041-06`)
instead of returning `null` → `MANUAL_REVIEW_REQUIRED` (422).

**What's preserved:**
- The customer's full entered address (including "Unit 31") is still what's
  sent to `/api/parcel/quote` and stored client-side for the property
  record/scheduling preset (`QuoteWidgetSection.tsx`'s `address` state is
  never mutated). Stripping happens only inside the geocoding call.
- `normalizedForHash`/cache keying is unchanged — still derived from the
  full original address, so "Unit 31" and "no unit" addresses get distinct
  cache entries (both resolving to the same parcel data, as before for
  address B).
- County GIS remains the acreage source — stripping only affects which
  string is sent to the *geocoder*; the county adapter call is unchanged
  (`adapter.lookup({ ...input, lat, lng }, ...)`).
- If neither the full nor the stripped address geocodes, behavior is
  unchanged: `MANUAL_REVIEW_REQUIRED` → 422 → amber "couldn't auto-detect"
  panel (Path 2, unchanged).

---

## B2 — `oversized` flag + manual-entry panel

### `server/routes/parcelQuote.ts`

```ts
const quote = result.acreage != null ? buildPricingQuote(result.acreage) : null;

// Properties whose parcel acreage exceeds the priced range (e.g. a condo/HOA
// shared parcel, or any large lot) can't be quoted from raw GIS acreage —
// the frontend should ask the customer for their unit's/treatment area size
// instead of rendering subscription/annual tiles with no price.
const oversized = result.acreage != null && result.acreage > 2.0;

...
return res.json({
  ok: true,
  normalizedAddress: result.normalizedAddress,
  county: result.county,
  apn: result.apn,
  acreage: result.acreage,
  acreageSource: result.acreageSource,
  confidence: result.confidence,
  quote,
  oversized,
  cached: result.cached,
});
```

`2.0` matches the existing tier-table cap (`CADENCE_TIERS`/`ANNUAL_TIERS`,
both `max: 2.00`) and the precedent in `AddressCheckerSection.tsx:110`
(`fetchedAcreage > 2`). It is intentionally **not** conditioned on whether the
address had a unit suffix — see
[MULTI_UNIT_PROPERTY_RULES_REPORT.md](./MULTI_UNIT_PROPERTY_RULES_REPORT.md)
for the evidence (D1/D2) behind this broadening from Phase 9's literal
wording.

### `use-property-lookup.ts`

Added `oversized?: boolean` to `ParcelQuoteResult` and `oversized:
body.oversized` in the mapped result.

### `QuoteWidgetSection.tsx`

- New state: `const [oversized, setOversized] = useState(false);`
- `handleSearch`: `setOversized(!!data.oversized);` alongside the existing
  `setAcreage`/`setCounty`/etc. on a successful lookup.
- Address/ZIP `onChange` handlers now also call `setOversized(false)` (same
  reset pattern as `lookupFailed`).
- New handlers:

  ```ts
  const handleOversizedPreset = (value: number) => {
    setAcreage(value);
    setAcreageSource("manual");
    setConfidence("low");
    setOversized(false);
  };

  const handleOversizedProceed = () => {
    const val = parseFloat(manualAcreage);
    const resolved = !isNaN(val) && val > 0 ? Math.min(val, 2) : 0.25;
    setAcreage(resolved);
    setAcreageSource("manual");
    setConfidence("low");
    setManualAcreage(resolved.toString());
    setOversized(false);
  };
  ```

  `handleOversizedProceed` clamps to `2` (rather than defaulting to 0.25 on
  out-of-range input) so a customer who enters e.g. `3` still lands on a
  priced tile (2 ac, the top tier) instead of looping back into the
  oversized/empty-tile state.

- Phase 2 (`phase === "plans"`) now branches:
  - `!oversized` → existing plan tiles, annual callout, frequency picker,
    grandfathering callout, and "Schedule Service" CTA — **unchanged**.
  - `oversized` → new panel: *"This looks like a shared or multi-unit
    property"*, explains the matched record's acreage, offers **0.05 / 0.10 /
    0.25 ac** presets (Phase 9 step 5) plus a free-form "Or enter your own
    (acres)" input + "See Pricing" button. Selecting any of these sets
    `acreage` to a value ≤ 2 ac, flips `oversized` to `false`, and the
    component re-renders with normal priced tiles on the next render — no
    additional API call.

The address pill above both branches is unchanged and still shows the raw
`{acreage} acres` from the lookup (e.g. "21.057 acres"), giving the customer
context for why the oversized panel appeared.

---

## Why both halves are required together

B1 alone would turn the Unit-31 address's 422 into a 200 with `acreage =
21.057` — which, **without B2**, hits the pre-existing empty-pricing-tile bug
(documented for address B in `QUOTE_REPRODUCTION_REPORT.md`/
`QUOTE_FALLBACK_UX_AUDIT.md`). B2 alone would fix that tile bug for B/D1/D2 but
leaves Unit 31 still 422ing. Together, Unit 31 now: geocodes (B1) → resolves
to the 21.057-ac shared parcel (unchanged county-GIS behavior) → `oversized:
true` (B2) → customer sees the new manual-entry panel → picks e.g. "0.10 ac"
→ normal priced tiles render for 0.10 ac.

See
[QUOTE_FIX_VALIDATION_REPORT.md](./QUOTE_FIX_VALIDATION_REPORT.md) for
post-fix reproduction results.
