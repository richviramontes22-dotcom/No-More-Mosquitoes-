# Phase 7 — API Contract Verification (lat/lng/placeId end-to-end)

## Status: ✅ Complete — contract already supported the new fields; verified end-to-end with Phase 6 wiring

This phase traced the `{ address, city, state, zip, lat, lng, placeId }`
payload from the new `<GoogleAddressAutocomplete>` selections (Phase 6) all
the way through to the Supabase cache, confirming no gaps.

## 1. Frontend → API: `client/hooks/use-property-lookup.ts`

`lookup(address, zip, city?, state?, lat?, lng?, placeId?)` (this signature
already existed prior to this sprint, from commit `d83cd9a`) does:

```ts
body: JSON.stringify({ address, zip, city, state: state ?? "CA", lat, lng, placeId })
```

POSTed to `/api/parcel/quote`. All three forms updated in Phase 6
(`QuoteWidgetSection`, `AddressCheckerSection`, `AddPropertyDialog`) now pass
`lat`, `lng`, `placeId` from `GoogleAddressAutocomplete`'s `onPlaceSelect`
result — previously these three call sites only passed
`(address, zip, city, state)`, so `lat`/`lng`/`placeId` were always
`undefined` in the request body. **No change needed to this hook itself.**

## 2. API route: `server/routes/parcelQuote.ts`

```ts
const { address, zip, city, state, lat, lng, placeId, propertyId } = req.body ?? {};
...
const result = await lookupParcel({
  address: address.trim(),
  zip: zip.trim().replace(/\D/g, "").slice(0, 5),
  city: city?.trim(),
  state: state?.trim() ?? "CA",
  lat: typeof lat === "number" ? lat : undefined,
  lng: typeof lng === "number" ? lng : undefined,
  placeId: typeof placeId === "string" ? placeId : undefined,
}, requestId);
```

Already validates types defensively (a malformed/missing `lat`/`lng`/`placeId`
from the client silently becomes `undefined` rather than erroring) and passes
all three through to `lookupParcel`. **No change needed.**

Also already persists `lat`/`lng` back to `properties.lat`/`lng` (added in
the `2026-05-28_property_coordinates.sql` migration, already applied in
Supabase) when `propertyId` is provided — a fire-and-forget, non-fatal write.

## 3. `server/services/parcel/parcelLookupService.ts`

```ts
let lat = input.lat;
let lng = input.lng;
...
if (lat == null || lng == null) {
  // geocode via Google → Nominatim → stripUnitSuffix retry (Phase 4)
}
```

When the frontend supplies `lat`/`lng` (Google Places Autocomplete path),
geocoding is **skipped entirely** — the request goes straight to county
detection → adapter lookup. This is the "skip geocoding when lat/lng
provided" requirement from the spec, and it predates this sprint (it was
already structured this way; Phase 4 only added the `placeId`/`source`/
`locationType` fields to the geocode-fallback branch).

`resolvedPlaceId = input.placeId ?? geo.placeId` (Phase 4) — frontend-supplied
`placeId` takes priority; if the frontend didn't supply one (manual-typed
address, Google script unavailable) but the backend's own geocoder resolved
one, that's used instead.

## 4. Cache: `server/services/parcel/cache.ts` + `parcel_lookup_cache` table

- `place_id` column already exists (migration `2026-05-26_parcel_lookup_cache.sql`,
  confirmed applied in Supabase), with a partial index
  `parcel_lookup_cache_place_id_idx ... where place_id is not null`.
- `getCachedParcel(addressHash, placeId)` already does
  `.or(address_hash.eq.<hash>,place_id.eq.<placeId>)` when a `placeId` is
  supplied — so a cache hit can occur via either the address hash or a
  previously-stored Google `place_id`, even if the customer's typed address
  text varies slightly between visits.
- `saveParcelToCache({ ..., placeId: resolvedPlaceId ?? null, ... })` (Phase 4
  change to `parcelLookupService.ts`) stores whichever `placeId` was resolved
  — frontend-supplied or geocoder-discovered.

## Conclusion

The full contract —
`GoogleAddressAutocomplete → usePropertyLookup → /api/parcel/quote → lookupParcel → cache`
— was **already wired for lat/lng/placeId before this sprint** (commit
`d83cd9a` laid the groundwork). The only missing piece was the frontend
*actually sending* these fields, which Phase 6 now does. Phase 4 additionally
ensured a geocoder-discovered `placeId` (when the frontend didn't supply one)
also reaches the cache.

## Validation

- `npm run typecheck` → exit code 0 (re-confirmed after this review; no code
  changes were made in this phase).
