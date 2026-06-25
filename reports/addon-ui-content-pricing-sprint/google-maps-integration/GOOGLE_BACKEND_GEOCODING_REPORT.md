# Phase 4 — Backend Geocoding Integration

## Status: ✅ Complete

Made Google Geocoding the **primary** geocoder in
`server/services/parcel/googleAddressService.ts`, with OSM Nominatim
preserved as the automatic fallback — satisfying the spec's "Google primary,
Nominatim fallback" requirement with the smallest possible change to the
existing fallback chain.

## 1. `geocodeAddress()` — Google-first, Nominatim-fallback

```ts
export async function geocodeAddress(
  address: string, zip: string, city?: string, state?: string, timeoutMs = 5000,
): Promise<GeocodeResult | null> {
  const fullQuery = [address, city, state, zip].filter(Boolean).join(", ");

  if (GOOGLE_SERVER_KEY) {
    const googleResult = await geocodeWithGoogle(fullQuery, timeoutMs);
    if (googleResult) return googleResult;
    // Google unavailable, errored, or had no result — fall through to Nominatim.
  }
  return geocodeWithNominatim(fullQuery, timeoutMs);
}
```

- `GOOGLE_SERVER_KEY = process.env.GOOGLE_MAPS_SERVER_KEY?.trim()` — read
  once at module load, **server-side only**. If unset (current production
  state, pending Phase 2/3), `geocodeWithGoogle` is never called and behavior
  is **byte-identical** to the pre-sprint Nominatim-only implementation.
- `geocodeWithGoogle()` calls
  `https://maps.googleapis.com/maps/api/geocode/json?address=...&key=...`,
  returns `null` on any non-`OK` status, HTTP error, timeout, or thrown
  exception — never throws, so a Google outage/quota error transparently
  becomes a Nominatim attempt.
- `geocodeWithNominatim()` is the pre-existing implementation, unchanged.

## 2. `GeocodeResult` extended (`server/services/parcel/types.ts`)

```ts
export type GeocodeSource = "google" | "nominatim";

export type GeocodeResult = {
  lat: number;
  lng: number;
  normalizedAddress: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  placeId?: string;       // new — Google place_id, undefined for Nominatim
  locationType?: string;  // new — Google geometry.location_type, undefined for Nominatim
  source: GeocodeSource;  // new — "google" | "nominatim"
};
```

Both new fields are optional and Nominatim's result simply omits them — no
changes needed to any Nominatim-only code path.

## 3. `stripUnitSuffix()` — preserved, source-agnostic

The existing `stripUnitSuffix(address)` retry (added in the prior
quote-regression sprint to handle Nominatim's inability to resolve
unit-suffixed addresses like "Unit 31") is **unchanged** and now also benefits
the Google path: if `geocodeAddress(fullAddress)` fails (Google returns no
result, or Google is absent and Nominatim returns nothing), the caller
(`parcelLookupService.ts`) retries with the unit suffix stripped, regardless
of which geocoder eventually succeeds.

## 4. `parcelLookupService.ts` — wiring `source`/`placeId`/`locationType` through

```ts
let resolvedPlaceId = input.placeId;
...
let geo = await geocodeAddress(input.address, input.zip, input.city, input.state, 5000);
if (!geo) {
  const { stripped, hadUnit } = stripUnitSuffix(input.address);
  if (hadUnit) geo = await geocodeAddress(stripped, input.zip, input.city, input.state, 5000);
}
if (geo) {
  lat = geo.lat;
  lng = geo.lng;
  normalizedAddress = geo.normalizedAddress;
  resolvedPlaceId = resolvedPlaceId ?? geo.placeId;
  // ... locationType also captured
  logger.info("parcel.geocode.success", { requestId, source: geo.source, strippedUnitSuffix });
}
```

- `resolvedPlaceId = input.placeId ?? geo.placeId` — a frontend-supplied
  `placeId` (from Google Places Autocomplete, Phase 5/6) takes priority; if
  absent, a `placeId` discovered by the backend's own Google geocode is used
  instead. Nominatim-sourced geocodes leave `placeId` undefined, same as
  before this sprint.
- `resolvedPlaceId` is persisted to `parcel_lookup_cache.place_id` (column
  already existed, migration `2026-05-26_parcel_lookup_cache.sql`).
- The `source` (`"google"` | `"nominatim"`) is logged via the
  `parcel.geocode.success` / `parcel.geocode.failed` checkpoints — this is
  the field used for quota/cost monitoring in
  [GOOGLE_MAPS_COST_CONTROL_REPORT.md](./GOOGLE_MAPS_COST_CONTROL_REPORT.md).

## 5. Geocoding is skipped entirely when the frontend supplies `lat`/`lng`

Pre-existing behavior (not changed by this sprint, but the precondition that
makes Phase 5/6's Autocomplete wiring valuable): if `input.lat`/`input.lng`
are present (Google Places Autocomplete selection), `geocodeAddress()` is
never called — the request proceeds straight to county detection and the
parcel adapter, saving a geocoding call on every Autocomplete-driven lookup.

## 6. Unit tests — `server/services/parcel/googleAddressService.spec.ts`

7 tests covering `stripUnitSuffix()` across comma/no-comma, `#`, `Apt`,
`Unit`, and `Suite` suffix variants, plus two "no suffix, unchanged" cases.
All 7 passing (see Phase 9 validation report).

## Validation

- `npm run typecheck` → exit 0
- `npm test` → `googleAddressService.spec.ts` 7/7 passing
- No changes to `countyDetector`, county adapters, acreage calculation, or
  pricing — this phase is scoped entirely to `googleAddressService.ts`,
  `types.ts`, and the geocode-result handling in `parcelLookupService.ts`.
