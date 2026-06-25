# Geocoder Strategy Audit

**Date:** 2026-06-11/12
**File audited:** `server/services/parcel/googleAddressService.ts`

---

## Does production use Google or Nominatim?

**Nominatim.** `geocodeAddress()` (`googleAddressService.ts:8-21`):

```ts
const GOOGLE_SERVER_KEY = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
...
export async function geocodeAddress(...) {
  const fullQuery = [address, city, state, zip].filter(Boolean).join(", ");
  if (GOOGLE_SERVER_KEY) {
    return geocodeWithGoogle(fullQuery, timeoutMs);
  }
  return geocodeWithNominatim(fullQuery, timeoutMs);
}
```

Confirmed locally: `GOOGLE_MAPS_SERVER_KEY set: false` (printed by
`scripts/test-quote-regression.ts` from `.env`). Production was confirmed the
same way in the prior session
([`PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md`](../PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md))
— the `normalizedAddress` returned in production matches Nominatim's
`display_name` format, not Google's `formatted_address` format.

## Env vars that control this

| Var | Effect | Status |
|---|---|---|
| `GOOGLE_MAPS_SERVER_KEY` | server-side: switches `geocodeAddress()` to Google Geocoding API | **unset** (local `.env` and production) |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | frontend: would enable Google Places Autocomplete *if* such a component existed | unset; **no consuming code exists anyway** (see [ADDRESS_NORMALIZATION_AUDIT.md](./ADDRESS_NORMALIZATION_AUDIT.md)) |

Both are listed as *optional* in
[`PARCEL_DEPLOYMENT_GUIDE.md`](../parcel-acreage-sprint/PARCEL_DEPLOYMENT_GUIDE.md:34-39).

## Was Google ever used before?

**No.** `googleAddressService.ts` (and the entire geocoding step) is brand new
in `d83cd9a` (2026-06-08) — see
[QUOTE_REGRESSION_TIMELINE.md](./QUOTE_REGRESSION_TIMELINE.md). The prior
system (`server/routes/regrid.ts`, May 12) never geocoded addresses at all: it
sent the raw address string to Regrid's `/parcels` search (an address-text
search, not lat/lng-based), or — for this specific test address — bypassed
everything via the hardcoded stub.

## Did a previous commit remove Google Places/geocoding?

**No.** There is nothing to remove — it never existed prior to `d83cd9a`,
which *added* `googleAddressService.ts` (with both Google and Nominatim
branches, Google preferred-but-unconfigured) as new functionality.

## Does the frontend have `VITE_GOOGLE_MAPS_BROWSER_KEY` configured?

No (not in `.env` or `.env.example` with a real value;
`PARCEL_DEPLOYMENT_GUIDE.md` lists it as optional/not-yet-configured). Moot
regardless, since no frontend code reads `import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY`
or renders an autocomplete widget.

## Does the public quote form use autocomplete?

**No.** `QuoteWidgetSection.tsx` is a plain text form (confirmed in
[ADDRESS_NORMALIZATION_AUDIT.md](./ADDRESS_NORMALIZATION_AUDIT.md) and the
prior session's report). It never sends `lat`/`lng`/`placeId`.

---

## Geocoding test results (this sprint, `scripts/test-quote-regression.ts`)

| Query | Result |
|---|---|
| `22216 Caminito Escobedo, Unit 31, Laguna Hills, CA, 92692` | **NULL** (zero results) |
| `22216 Caminito Escobedo, Laguna Hills, CA, 92692` (no unit) | `lat=33.6269507, lng=-117.7420574` ✅ |
| `22216 Caminito Escobedo #31, Laguna Hills, CA, 92692` | **NULL** |
| `22216 Caminito Escobedo Apt 31, Laguna Hills, CA, 92692` | **NULL** |
| `22216 Caminito Escobedo Unit 31, Laguna Hills, CA, 92692` (no comma) | **NULL** |
| `100 Civic Center Dr, Anaheim, CA, 92801` | cache hit (previously geocoded OK) |
| `20 Civic Center Plaza, Santa Ana, CA, 92701` | `lat=33.7500241, lng=-117.8731492` ✅ (fresh) |

**With Google** (not tested live — no key configured, and we should not
provision/spend against a production key during an investigation): Google's
Geocoding API is well-documented to handle `subpremise` components (unit/apt
numbers) far better than Nominatim — it typically returns the building's
rooftop/parcel coordinates with the unit recorded in
`address_components[].types: ["subpremise"]`, rather than failing outright.
This is *consistent with* but not independently re-verified in this sprint;
[`PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md`](../PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md)
already covered the Google-key option (Option C there).

## Conclusion

The geocoder strategy itself (Nominatim default, Google optional via env var)
is correctly implemented and unchanged from its `d83cd9a` design. The gap is
**Nominatim's inability to resolve unit-suffixed US addresses at all** — a
known limitation of the free tier, not a misconfiguration. The fix in this
sprint addresses this at the input layer (strip the unit suffix before
querying Nominatim — see
[QUOTE_FIX_IMPLEMENTATION_REPORT.md](./QUOTE_FIX_IMPLEMENTATION_REPORT.md))
rather than by requiring `GOOGLE_MAPS_SERVER_KEY`, per the "do not assume
Google is required" framing established earlier in this engagement
([`reports/PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md`](../PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md),
"Clarification" section).
