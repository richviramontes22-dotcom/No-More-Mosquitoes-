# Parcel Quote: Production Fix Verification & Remaining 422 Investigation
**Date:** 2026-06-11/12

---

## Executive Summary

Two distinct issues were in play this session:

1. **CONFIRMED FIXED**: `/api/parcel/quote` (and every other JSON-body POST/PUT/PATCH
   endpoint under `/api/*`) was returning `400 INVALID_ADDRESS` for *every* request,
   regardless of payload, due to a `serverless-http` v3.2.0 incompatibility with
   `body-parser` v2.x (bundled by Express 5). Fixed by upgrading to `serverless-http`
   v4.0.0 (commit `c49d934`). **Verified end-to-end on production** with two real
   addresses returning real Orange County GIS parcel data.

2. **NOT A REGRESSION — pre-existing, documented behavior**: The specific address
   `22216 Caminito Escobedo, Unit 31, Laguna Hills, CA 92692` still returns
   `422 MANUAL_REVIEW_REQUIRED` ("We need your coordinates..."). Root cause: the
   geocoder (OSM Nominatim, used by both local and production — no Google Maps key
   configured) returns **zero results for addresses containing a `Unit ##` /
   apartment-style suffix**. This is a geocoder limitation, not something the
   serverless-http fix touches. See "Part 2" below for full analysis, including why
   a naive fix (stripping "Unit 31") would make this *specific* address's quote
   **worse**, not better.

---

## Part 1: Production Outage — Fixed and Verified

### Root cause
`serverless-http@3.2.0`'s `ServerlessRequest` (`lib/request.js`) builds a fake
`socket` object with `readable: false`. `body-parser@2.x`'s JSON/urlencoded/raw/text
parsers all start with:

```js
if (isFinished(req)) {
  debug('body already parsed')
  next()
  return
}
```

`on-finished`'s `isFinished()` for an `IncomingMessage` returns:

```js
Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable))
```

Because `socket.readable === false` unconditionally, `isFinished(req)` is **always
`true`**, so body-parser thinks the request is already fully processed and never
reads/parses the body. `req.body` is left as the raw `Buffer` set in the
`ServerlessRequest` constructor — `express.json()` never runs.

Confirmed via `DEBUG=body-parser:* npx tsx ...`:
```
body-parser:json body already parsed
```

### Fix
Upgraded `serverless-http` `3.2.0` → `4.0.0` (`package.json`, `pnpm-lock.yaml`,
commit `c49d934`, pushed to `main`). v4.0.0's `ServerlessRequest` uses a real
`PassThrough` stream as the socket (`readable: true` by default), so
`isFinished()` correctly returns `false` until the body stream is actually
consumed. Diff between 3.2.0 → 4.0.0 is minimal/additive (no breaking API changes
for our usage — confirmed via full recursive diff of the package contents).

### Verification (production, `https://nomoremosquitoes.us`)

```
POST /api/parcel/quote {"address":"100 Civic Center Dr","zip":"92801","city":"Anaheim","state":"CA"}
→ 200 {"ok":true,"county":"orange","apn":"255-161-05","acreage":3.959,
       "acreageSource":"cache","confidence":"medium","quote":{...},"cached":true}

POST /api/parcel/quote {"address":"22216 Caminito Escobedo","zip":"92692","city":"Laguna Hills","state":"CA"}
→ 200 {"ok":true,"county":"orange","apn":"588-041-06","acreage":21.057,
       "acreageSource":"geometry_calculated","confidence":"medium","quote":{...},"cached":false}
```

Both return real GIS-backed results. `req.body` is parsing correctly; the
production 400/outage chain (build timeout → express externalization → body
parsing) is fully resolved.

---

## Part 2: `22216 Caminito Escobedo, Unit 31` → 422 MANUAL_REVIEW_REQUIRED

### What the user sees
The pricing widget (`client/components/sections/QuoteWidgetSection.tsx`) is a
plain text form — it does **not** use Google Places Autocomplete and never sends
`lat`/`lng`/`placeId` (see lines 142-162). So `/api/parcel/quote` always falls
through to server-side geocoding (`server/services/parcel/googleAddressService.ts`).

### Root cause: geocoder cannot resolve "Unit 31"

Neither local nor production has `GOOGLE_MAPS_SERVER_KEY` set (confirmed: the
`normalizedAddress` returned for the no-unit query,
`"22216, Caminito Escobedo, North Laguna Hills, Laguna Hills, Orange County,
California, 92653, United States"`, is OSM Nominatim's `display_name` format, not
Google's `formatted_address` format). So both environments use
`geocodeWithNominatim()`.

Direct test of `geocodeAddress()`:

| Query sent to Nominatim | Result |
|---|---|
| `22216 Caminito Escobedo, Unit 31, Laguna Hills, CA, 92692` | `null` (zero results) |
| `22216 Caminito Escobedo, Laguna Hills, CA, 92692` | `lat=33.6269507, lng=-117.7420574` ✅ |

Production confirms the same split:

```
POST /api/parcel/quote {address: "...Unit 31", zip: "92692", ...}
→ 422 {"code":"MANUAL_REVIEW_REQUIRED","message":"We need your coordinates to look up this property. Please try again."}

POST /api/parcel/quote {address: "22216 Caminito Escobedo" (no unit), zip: "92692", ...}
→ 200 {"ok":true,"county":"orange","apn":"588-041-06","acreage":21.057,...}
```

**Nominatim's address index does not contain unit/apartment-level entries for most
US addresses** — appending `Unit 31`, `Apt 5`, `#12`, etc. to the query string
causes Nominatim's structured search to return zero matches rather than ignoring
the unrecognized token. This is a documented OSM/Nominatim limitation, not a bug in
our code.

### Why this is NOT a regression

This exact code path (`lat == null || lng == null` → `MANUAL_REVIEW_REQUIRED`,
reason `no_coords`) is the **documented, intentional behavior** —
[`PARCEL_FALLBACK_AND_ERROR_HANDLING_REPORT.md`](parcel-acreage-sprint/PARCEL_FALLBACK_AND_ERROR_HANDLING_REPORT.md)
("Manual Review Behavior" section) describes exactly this fallback: the amber
"We couldn't auto-detect this property" panel with manual acreage entry, which is
precisely what the screenshot shows. Before this session's fix, **every** address
hit `400 INVALID_ADDRESS` before ever reaching this logic — so this address has
never successfully returned a quote via this endpoint; the body-parser bug simply
replaced one error with another for it.

### Why "just strip the unit number" is not a clean fix here

If the unit suffix is stripped before geocoding (so the lookup proceeds with
`22216 Caminito Escobedo, Laguna Hills, CA, 92692`), the request *does* succeed —
but resolves to **APN `588-041-06`, 21.057 acres**, per
[`PARCEL_SOURCE_MAPPING_REPORT.md`](parcel-acreage-sprint/PARCEL_SOURCE_MAPPING_REPORT.md)
this is a `geometry_calculated` result straight from OC GIS's parcel polygon at
that point. 21 acres is almost certainly the **HOA/common-area parcel for the
entire condo complex**, not the individual unit's footprint.

That acreage exceeds every pricing tier in `QuoteWidgetSection.tsx`
(`CADENCE_TIERS` / `ANNUAL_TIERS` cap at `max: 2.00`), so the "plans" screen would
render with **no subscription price, no annual price** — only the flat one-time
$175 — which is a more confusing broken state than the current amber
"enter your lot size manually" panel.

> Note: my verification request for the no-unit address (`200` response above) was
> cached into `parcel_lookup_cache` under the address hash for
> `"22216 Caminito Escobedo, Laguna Hills, CA, 92692"` (no unit). This does **not**
> collide with the `Unit 31` address hash, so it has no effect on the user's actual
> queries — flagged here only for completeness.

---

## Clarification: Geocoding vs. County GIS — Why a Google Key Ever Comes Up

A natural question after Part 2: county GIS servers are free, no-auth, and are
the *only* source of parcel/acreage data — so why does `GOOGLE_MAPS_SERVER_KEY`
appear anywhere in this system at all?

**The parcel/acreage data itself never touches Google.** Every adapter (e.g.
`OrangeCountyAdapter.ts`) builds its request via
`BaseCountyAdapter.buildArcgisPointQuery()` — confirmed to be the *only*
query-builder in the codebase — which sends a spatial
`esriSpatialRelIntersects` point-in-polygon query directly to the county's
ArcGIS REST endpoint. Free, no key, no Google involvement, per
[PARCEL_SOURCE_MAPPING_REPORT.md](parcel-acreage-sprint/PARCEL_SOURCE_MAPPING_REPORT.md)
and [PARCEL_COST_OPTIMIZATION_REPORT.md](parcel-acreage-sprint/PARCEL_COST_OPTIMIZATION_REPORT.md).

**The catch: that spatial query needs a lat/lng point first.** The user types a
street address, not coordinates, and `buildArcgisPointQuery` is spatial-only —
there is no address/attribute (`where=SITE_ADDRESS='...'`) fallback anywhere in
the codebase, even though OC's layer exposes a `SITE_ADDRESS` field. So before
the free county-GIS step can run at all, something has to convert "22216
Caminito Escobedo, Laguna Hills, CA" → `(lat, lng)`. That conversion —
"geocoding" — is a separate prerequisite step, handled entirely by
`server/services/parcel/googleAddressService.ts`, not by any county server.

**Where Google fits in: an optional upgrade to that one prerequisite step.**
[PARCEL_DEPLOYMENT_GUIDE.md](parcel-acreage-sprint/PARCEL_DEPLOYMENT_GUIDE.md)
lists `GOOGLE_MAPS_SERVER_KEY` as *"Optional — enables Google Geocoding (more
accurate than Nominatim)."* That is the entire role Google was ever designed to
play: a paid, more-accurate alternative to the free OSM Nominatim geocoder for
turning a typed address into coordinates. Google was **never** "the tool that
gets the quote" — the quote always comes from county GIS, with or without Google.

**Current state:** neither local nor production has `GOOGLE_MAPS_SERVER_KEY` set,
so both use Nominatim ($0/month) for this step today, per
[PARCEL_COST_OPTIMIZATION_REPORT.md](parcel-acreage-sprint/PARCEL_COST_OPTIMIZATION_REPORT.md).
Google plays no role in the system as currently deployed.

**How this reframes Option C below:** Option C is not "switch where the quote
comes from to Google" — the quote source (county GIS) is identical either way.
It is narrowly "swap the free address→coordinates converter for a paid one that
handles `Unit ##` / subpremise suffixes better," which would let *more*
addresses reach the same free county-GIS lookup that already works for every
other address.

---

## Conclusion & Options

The production-wide outage (Part 1) is fixed and verified. The specific 422 for
`22216 Caminito Escobedo, Unit 31` is a **pre-existing geocoding-coverage gap for
condo/multi-unit addresses**, working as designed per the documented fallback
matrix — the amber manual-entry panel is the correct, intended UX for this case.

No code change was made for Part 2, since the two candidate "fixes" both have
real downsides:

- **Option A (do nothing)**: Keep current behavior. User enters lot size manually
  (the "Use 0.25 ac" shortcut, or a more accurate per-unit estimate) and proceeds —
  this already works today.
- **Option B (strip unit/suite/apt suffixes before geocoding)**: Would make
  *some* condo addresses resolve automatically, but for parcels shared across many
  units (like this one, 21 acres), it produces an acreage that breaks the pricing
  tier display (empty subscription/annual prices). Would need an additional
  safeguard — e.g., if `acreage > 2.0` **and** the original address contained a
  unit/apt designator, treat it as `MANUAL_REVIEW_REQUIRED` instead of returning a
  broken quote.
- **Option C (geocode with Google)**: Set `GOOGLE_MAPS_SERVER_KEY` in
  production — Google's geocoder handles subpremise/unit addresses better and may
  return a more precise rooftop point. Would still need Option B's "oversized
  shared parcel" safeguard, since the underlying GIS parcel polygon is the same
  regardless of geocoder. (Per the "Clarification" section above, this only
  changes the address→coordinates step — the quote itself still comes from the
  same free county GIS query either way.)

Recommend confirming with the user which (if any) of B/C is wanted before
implementing — both are small, scoped changes to
`server/services/parcel/parcelLookupService.ts` / `googleAddressService.ts`, but
they change observable behavior for an entire class of addresses (condos/multi-unit
buildings), not just this one.
