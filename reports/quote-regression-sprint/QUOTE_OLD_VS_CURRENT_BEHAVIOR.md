# Quote Tool: Old vs. Current Behavior

**Date:** 2026-06-11/12
**Compares:** commit `5935889` (2026-05-12, old) vs. current `HEAD`/`c49d934` (2026-06-08+, new)

---

## TL;DR — "Why did this address work before?"

**It didn't, in any meaningful sense.** The old `/api/regrid/parcel` route
contained a hardcoded developer stub:

```ts
// server/routes/regrid.ts (added in 5935889, still present, now unreachable)
// --- TEMPORARY FALLBACK FOR TEST ADDRESS ---
if (address.toLowerCase().includes("caminito escobedo") || address.toLowerCase().includes("22216")) {
  console.log("Using pre-verified data for test address.");
  return res.json({
    acreage: 0.07,
    sqft: 3049,
    note: "Data retrieved from local cache"
  });
}
// --- END FALLBACK ---
```

Any request whose `address` field contained the substrings `"22216"` or
`"caminito escobedo"` (case-insensitive) — **with or without `Unit 31`, `#31`,
`Apt 5`, or anything else** — short-circuited *before any geocoder or external
API call* and returned a fixed `{ acreage: 0.07, sqft: 3049 }`. That is a
plausible value for a single condo unit's exclusive-use lot (~3,049 sq ft),
which is why the old widget always "worked" and looked correct for this
address.

The new `/api/parcel/quote` pipeline has **no such stub**. It performs a real
OSM Nominatim geocode of the full address string, which — like virtually all
US addresses with a `Unit`/`Apt`/`#`/`Suite` suffix — returns zero results
(see [GEOCODER_STRATEGY_AUDIT.md](./GEOCODER_STRATEGY_AUDIT.md)). No
coordinates → `MANUAL_REVIEW_REQUIRED` → `422`.

**This is not a regression in correctness.** The old "working" result was
fabricated test data that happened to be plausible. The new result is the
honest output of a real, general-purpose system encountering a real geocoder
limitation that affects this entire class of addresses (see
[QUOTE_REPRODUCTION_REPORT.md](./QUOTE_REPRODUCTION_REPORT.md) — `#31` and
`Apt 31` variants fail identically).

---

## Point-by-point comparison

| Question | Old (`5935889`, May 12) | Current (`d83cd9a`+, June 8+) |
|---|---|---|
| **Endpoint used** | `POST /api/regrid/parcel` (`server/routes/regrid.ts`) | `POST /api/parcel/quote` (`server/routes/parcelQuote.ts`) |
| **Did it use Regrid?** | Yes for the general case (`api.regrid.com/api/v2/parcels`, requires `REGRID_API_KEY`) — but **this exact address never reached Regrid**, it hit the hardcoded stub above first. | No. `RegridFallbackAdapter.ts` exists but is **not** in `ADAPTER_MAP` (`parcelLookupService.ts:17-23`) and `flags.regridFallback()` defaults `false`. Regrid plays no role. |
| **Did it use Google Places Autocomplete?** | No. Never implemented in either version — only marketing copy (`client/lib/translations.ts`) mentions "Connects to Google Places or Mapbox" aspirationally. No `google.maps`/`Autocomplete` code exists anywhere in `client/`. | Same — still not implemented. `usePropertyLookup`'s new signature added `lat`/`lng`/`placeId` params (for a *future* Places integration) but `QuoteWidgetSection.tsx` never populates or passes them — always `undefined`. |
| **Did it strip unit/apartment/suite values?** | No. Not needed — the hardcoded stub matched on substrings (`"22216"`/`"caminito escobedo"`) regardless of any suffix. | No (before this sprint's fix). The full address string, including `Unit 31`, is sent verbatim to the geocoder. |
| **Did it pass lat/lng/placeId?** | No — old `lookup()` signature was `(address, zip, city?, state?)`, no coordinate params existed. | Signature supports `(address, zip, city?, state?, lat?, lng?, placeId?)`, but `QuoteWidgetSection.tsx` only ever calls `lookup(address, zip, city, stateVal)` — coordinates are always `undefined`. |
| **Did it accept manual acreage differently?** | Yes — significantly. `acreage` state defaulted to **0.2** and was **always live and editable** via a slider + number input. Pricing (`calculatePricing({ acreage, ... })`) rendered immediately on page load using this default, *before* any address search. "Search Property Acreage" was an optional helper that, on success, simply overwrote the slider value. A failed/skipped search left pricing fully functional at 0.2 ac. | Pricing is gated behind `phase === "plans"`, reached only via (a) a successful parcel lookup, or (b) the manual-fallback "See Pricing" button after a *failed* lookup. There is no default/always-visible pricing on page load. |
| **Did it bypass parcel GIS?** | Yes, for this address — entirely, via the hardcoded stub (no geocode, no Regrid call, no GIS call of any kind). | No bypass of any kind exists. Every address (this one included) goes through real geocoding + real county ArcGIS point-in-polygon query. |
| **Did it price based on user-entered acreage rather than parcel acreage?** | Yes, by default — pricing always reflects whichever value is currently in the `acreage` state, whether from a successful search, a failed search (unchanged from 0.2), or direct slider/input edits. The user did not need a successful lookup to get a price. | Only in the manual-fallback path, and only after the user explicitly enters a value and clicks "See Pricing". |
| **Did it silently default to 0.25 acres?** | It defaulted to **0.2 acres** (not 0.25), silently, on initial page load — before the user typed anything. | 0.25 is only a *one-click suggestion* ("Use 0.25 ac" button) inside the manual-fallback panel, shown only after a failed lookup. Never applied automatically/silently. |
| **Did the hardcoded test-address stub still exist after `d83cd9a`?** | n/a | **Yes** — `server/routes/regrid.ts:49-51` is byte-for-byte unchanged and the route is still mounted at `/api/regrid` (`server/index.ts:197`, marked "legacy — kept for backward compat"). It is simply never called by any current frontend code. |

---

## Was the d83cd9a change intentional?

**The endpoint swap (Regrid → county GIS) was clearly intentional** — it's the
core deliverable of "Production readiness sprint" (1,742 new lines implementing
a full multi-county ArcGIS adapter system with caching, rate limiting, and
checkpoints, vs. the old single paid-API integration with a test stub).
Replacing `/api/regrid/parcel`'s hardcoded fallback with real, general-purpose
GIS data is exactly the kind of change a "production readiness" pass should
make — relying on a stub that returns fixed data for one address is not
production-viable.

**The side effect — that this *specific* address now exercises a real
geocoder edge case it never hit before — was almost certainly not evaluated**,
because doing so would have required noticing that the only thing making this
address "work" in prior demos/screenshots was the stub, not a real lookup.
There's no evidence (commit message, code comment, or report) that anyone
intentionally decided "unit-numbered addresses should require manual review."
It is an **accidental, but correct, consequence** of removing fake test data.

## Is the current `MANUAL_REVIEW_REQUIRED` behavior correct, or overly aggressive?

**Correct, not overly aggressive — and not specific to this address.** Per
[QUOTE_REPRODUCTION_REPORT.md](./QUOTE_REPRODUCTION_REPORT.md), Nominatim
returns zero results for `Unit 31`, `#31`, and `Apt 31` variants alike. This is
a documented OSM/Nominatim limitation affecting essentially all
condo/apartment-style US addresses, not a bug introduced by this codebase. The
`422` + amber "enter your lot size manually" fallback is the system's
documented, designed behavior for *any* address the geocoder can't resolve
([`PARCEL_FALLBACK_AND_ERROR_HANDLING_REPORT.md`](../parcel-acreage-sprint/PARCEL_FALLBACK_AND_ERROR_HANDLING_REPORT.md)).

What *is* fixable — and is the actual opportunity here — is **improving the
hit rate** for this class of address before falling back to manual entry. See
[QUOTE_FIX_DECISION_MATRIX.md](./QUOTE_FIX_DECISION_MATRIX.md).
