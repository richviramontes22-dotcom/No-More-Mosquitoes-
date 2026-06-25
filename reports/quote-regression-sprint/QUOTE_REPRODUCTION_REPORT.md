# Quote Reproduction Report (Pre-Fix Baseline)

**Date:** 2026-06-11/12
**Environment:** local, via `npx tsx scripts/test-quote-regression.ts` (direct calls to
`geocodeAddress()` and `lookupParcel()` — the same functions
`POST /api/parcel/quote` calls). `GOOGLE_MAPS_SERVER_KEY` not set (confirmed
from `.env`), so all geocoding uses OSM Nominatim, matching production
([PARCEL_COST_OPTIMIZATION_REPORT.md](../parcel-acreage-sprint/PARCEL_COST_OPTIMIZATION_REPORT.md)).

All results below are captured **before** the Phase 9 fix was applied — this
is the regression baseline. See
[QUOTE_FIX_VALIDATION_REPORT.md](./QUOTE_FIX_VALIDATION_REPORT.md) for the
same matrix re-run after the fix.

---

## A — `22216 Caminito Escobedo, Unit 31, Laguna Hills, CA 92692`

| Field | Value |
|---|---|
| Geocoder result | `NULL` (Nominatim, zero results) |
| County detected | `orange` (from ZIP 92692) |
| County GIS result | not attempted — no coordinates |
| `lookupParcel` outcome | `errorCode: MANUAL_REVIEW_REQUIRED`, reason `no_coords` |
| `POST /api/parcel/quote` status | **`422`** |
| Response body | `{"ok":false,"code":"MANUAL_REVIEW_REQUIRED","message":"We need your coordinates to look up this property. Please try again."}` |
| requestId | `efa280c7-be25-4918-8cc7-b79b86f8e40a` |
| Server log sequence | `parcel.lookup.started` → `parcel.cache.miss` → `parcel.county.detected (orange)` → `parcel.manual_review (reason: no_coords)` |
| Pricing result | none |
| **UI shown to customer** | `usePropertyLookup` sets `error = "manual_required"` → `QuoteWidgetSection.tsx` sets `lookupFailed = true` → amber panel: **"We couldn't auto-detect this property"** with manual lot-size input, "Use 0.25 ac" button, "See Pricing" button |

This matches the production behavior already documented in
[`PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md`](../PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md).

---

## B — `22216 Caminito Escobedo, Laguna Hills, CA 92692` (no unit)

| Field | Value |
|---|---|
| Geocoder result | **OK** — `lat=33.6269507, lng=-117.7420574` |
| Normalized address | `"22216, Caminito Escobedo, North Laguna Hills, Laguna Hills, Orange County, California, 92653, United States"` (Nominatim format) |
| County detected | `orange` |
| County GIS result | cache hit (cached during prior session's production verification) — `apn=588-041-06`, `acreage=21.057`, `acreageSource=cache`, `confidence=medium` |
| `lookupParcel` outcome | success |
| `POST /api/parcel/quote` status | `200` |
| Response body (shape) | `{"ok":true,"county":"orange","apn":"588-041-06","acreage":21.057,"acreageSource":"cache","confidence":"medium","quote":{...},"cached":true}` |
| requestId | `bed98c75-0c33-405b-acdb-f2abaa06a26c` |
| Server log sequence | `parcel.lookup.started` → `parcel.cache.hit (county: orange, acreageSource: cache)` |
| Pricing result (**pre-fix**) | `buildPricingQuote(21.057)`: `subscription.cadenceOptions = []` (no tier covers >2.00 ac), `annual.cents = null`, `one_time.cents = 17500` |
| **UI shown to customer (pre-fix)** | Lookup "succeeds" → `phase = "plans"`. Address pill shows "21.057 acres". **Recurring Service and Annual Plan tiles render with no price** (only icon/label/description); **One-Time Treatment shows "Starting at $175"**. No error is shown — looks like a partially-broken pricing page. |

This is the **21-acre HOA/common-area parcel** scenario flagged in Part 2 of
[`PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md`](../PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md).

---

## C1 — `22216 Caminito Escobedo #31, Laguna Hills, CA 92692`

| Field | Value |
|---|---|
| Geocoder result | `NULL` (Nominatim, zero results) |
| `lookupParcel` outcome | `errorCode: MANUAL_REVIEW_REQUIRED`, reason `no_coords` |
| `POST /api/parcel/quote` status | `422` |
| requestId | `415e859d-9edb-4337-8ba2-182300947a39` |
| **UI shown to customer** | Same amber "couldn't auto-detect" panel as **A** |

## C2 — `22216 Caminito Escobedo Apt 31, Laguna Hills, CA 92692`

| Field | Value |
|---|---|
| Geocoder result | `NULL` (Nominatim, zero results) |
| `lookupParcel` outcome | `errorCode: MANUAL_REVIEW_REQUIRED`, reason `no_coords` |
| `POST /api/parcel/quote` status | `422` |
| requestId | `0cca99a1-30ed-4860-9c77-b97ec8c7f54e` |
| **UI shown to customer** | Same amber "couldn't auto-detect" panel as **A** |

## C3 — `22216 Caminito Escobedo Unit 31, Laguna Hills, CA 92692` (no comma)

| Field | Value |
|---|---|
| Geocoder result | `NULL` (Nominatim, zero results) |
| `lookupParcel` outcome | `errorCode: MANUAL_REVIEW_REQUIRED`, reason `no_coords` |
| `POST /api/parcel/quote` status | `422` |
| requestId | `e6d21665-bf25-463c-b755-5c25a1b03c32` |
| **UI shown to customer** | Same amber "couldn't auto-detect" panel as **A** |

**C1/C2/C3 confirm this is a general Nominatim limitation, not specific to the
literal string `"Unit 31"`** — `#31`, `Apt 31`, and `Unit 31` (with or without
a leading comma) all fail identically.

---

## D1 — `100 Civic Center Dr, Anaheim, CA 92801` ("known working" address)

| Field | Value |
|---|---|
| Geocoder result | not re-queried — cache hit |
| County GIS result | cache hit — `apn=255-161-05`, `acreage=3.959`, `acreageSource=cache`, `confidence=medium` |
| `POST /api/parcel/quote` status | `200` |
| requestId | `b5269b98-1c9d-45f6-8299-9b9e9a1f6060` |
| Pricing result (**pre-fix**) | **Also `acreage > 2.00`** → same as B: `subscription.cadenceOptions = []`, `annual.cents = null`, `one_time.cents = 17500` |
| **UI shown to customer (pre-fix)** | Same partially-broken "plans" screen as **B** — Recurring/Annual tiles show no price |

## D2 — `20 Civic Center Plaza, Santa Ana, CA 92701` ("known working" address)

| Field | Value |
|---|---|
| Geocoder result | **OK (fresh, not cached)** — `lat=33.7500241, lng=-117.8731492`, normalized `"Santa Ana City Hall, 20, Civic Center Plaza, Santa Ana, Orange County, California, 92702, United States"` |
| County GIS result | **fresh county lookup** — `apn=008-036-35`, `acreage=3.352`, `acreageSource=geometry_calculated`, `confidence=medium` |
| `POST /api/parcel/quote` status | `200` |
| requestId | `593e157f-9368-42c7-86b1-edbbdefac18c` |
| Server log sequence | `parcel.lookup.started` → `parcel.cache.miss` → `parcel.county.detected (orange)` → `parcel.county.lookup.start` → `parcel.county.lookup.success (acreage=3.352, confidence=medium)` → `parcel.lookup.county_success (acreageSource=geometry_calculated)` |
| Pricing result (**pre-fix**) | **Also `acreage > 2.00`** → `subscription.cadenceOptions = []`, `annual.cents = null`, `one_time.cents = 17500` |
| **UI shown to customer (pre-fix)** | Same partially-broken "plans" screen as **B/D1** |

**Important finding:** D1 and D2 (both government civic centers — picked as
"known working" examples because they return `200` with a real APN) **also
exceed the 2.00-acre cap on every pricing tier** (`CADENCE_TIERS` /
`ANNUAL_TIERS` in `client/components/sections/QuoteWidgetSection.tsx` and
`server/services/parcel/pricingQuote.ts`). The "empty pricing tiles" problem
described for address B (the 21-acre HOA parcel) is **not specific to
condo/unit addresses** — it affects *any* address whose real parcel acreage
exceeds 2 acres, which includes large legitimate residential lots and
commercial parcels, not just shared condo parcels. This broadens the scope of
the "oversized parcel" safeguard in
[QUOTE_FIX_DECISION_MATRIX.md](./QUOTE_FIX_DECISION_MATRIX.md) /
[MULTI_UNIT_PROPERTY_RULES_REPORT.md](./MULTI_UNIT_PROPERTY_RULES_REPORT.md).

---

## Summary table

| Case | Geocode | API status | acreage | Pricing tiles OK? | UI |
|---|---|---|---|---|---|
| A `Unit 31` | fail | 422 | — | n/a | amber manual-entry panel |
| B no unit | OK (cached) | 200 | 21.057 | **No** — sub/annual empty | "broken-looking" plans screen |
| C1 `#31` | fail | 422 | — | n/a | amber manual-entry panel |
| C2 `Apt 31` | fail | 422 | — | n/a | amber manual-entry panel |
| C3 `Unit 31` no comma | fail | 422 | — | n/a | amber manual-entry panel |
| D1 Anaheim Civic Center | OK (cached) | 200 | 3.959 | **No** — sub/annual empty | "broken-looking" plans screen |
| D2 Santa Ana Civic Center | OK (fresh) | 200 | 3.352 | **No** — sub/annual empty | "broken-looking" plans screen |
