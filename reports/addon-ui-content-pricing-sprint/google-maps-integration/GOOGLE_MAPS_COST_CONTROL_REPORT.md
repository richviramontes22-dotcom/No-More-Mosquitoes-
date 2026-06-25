# Phase 8 — Quota / Cost Safety

## Status: ✅ Documentation complete (quota configuration is a manual Console step — see Phase 2)

This is a documentation-only phase. No code changes. It records the
recommended beta quotas, why they're safe for this integration's actual call
volume, how to configure them, and how the existing design already limits
blast radius if a quota is ever hit or a key is ever compromised.

## 1. Recommended beta quotas

| API | Recommended cap | Where to set it |
|---|---|---|
| Geocoding API | **500 requests/day** | Console → APIs & Services → Geocoding API → Quotas |
| Places API (Autocomplete) | **1,000 sessions/day** | Console → APIs & Services → Places API → Quotas |
| Maps JavaScript API | **1,000 loads/day** | Console → APIs & Services → Maps JavaScript API → Quotas |

These match the values specified in the project's `autogpt.json` spec.

### Why these are safe headroom, not a tight squeeze

- **Geocoding**: only called when the frontend does *not* supply `lat`/`lng`
  (manual typing without Autocomplete, or Autocomplete unavailable), **and**
  the address isn't already in `parcel_lookup_cache` (permanent cache —
  see Phase 7). Realistic beta traffic (a handful of quote/address-checker
  submissions and property adds per day) is nowhere near 500/day; this cap
  mainly guards against a runaway loop or scraping bot, not normal usage.
- **Places Autocomplete**: the legacy `google.maps.places.Autocomplete`
  widget (used by `GoogleAddressAutocomplete.tsx`, Phase 5) bills per
  *session* (one session = however many keystrokes/predictions it takes a
  user to pick or abandon a suggestion), not per keystroke. 1,000
  sessions/day comfortably covers far more than 1,000 individual page visits
  with address fields.
- **Maps JavaScript API**: one "load" per page view that mounts
  `GoogleAddressAutocomplete` (the script loader in
  `client/lib/googleMapsLoader.ts` is a singleton — it injects the script at
  most once per browser tab, cached for the session). 1,000/day covers
  ~1,000 unique visits to pages with an address field.

## 2. Keeping Places Autocomplete inside "Basic Data" pricing

`GoogleAddressAutocomplete.tsx` requests only:

```ts
const AUTOCOMPLETE_FIELDS = ["address_components", "formatted_address", "geometry", "place_id"];
```

All four are **Basic Data** fields, included in the per-session Autocomplete
price with **no additional Place Details charge**. Do not add fields like
`opening_hours`, `website`, `rating`, etc. (Contact/Atmosphere data) to this
list — those incur extra per-call costs on top of the session price.

## 3. Caching reduces repeat Geocoding cost to near-zero

`parcel_lookup_cache` (Supabase, permanent — parcel boundaries rarely change)
already deduplicates by `address_hash` **and** by Google `place_id` (Phase 7).
Once any address has been successfully geocoded once (by Google or
Nominatim), every subsequent lookup for that same address/place — by any
customer — is a cache hit and makes **zero** calls to Google or Nominatim.
Over time, the steady-state Geocoding call volume approaches just the rate of
*new, never-before-seen* addresses.

## 4. What happens if a quota is exceeded (graceful degradation, not failure)

This integration was explicitly designed so hitting a quota never breaks the
quote tool:

- **Geocoding quota hit** → Google returns a non-`OK` status →
  `geocodeWithGoogle()` returns `null` → `geocodeAddress()` falls through to
  Nominatim (Phase 4, unchanged fallback chain). Customer sees no error.
- **Places/Maps JS quota hit** → the script either fails to load or
  `google.maps.places.Autocomplete` calls start failing →
  `useGoogleMapsScript()` reports `"error"` →
  `GoogleAddressAutocomplete` renders as a plain `<Input>` with no dropdown.
  Manual typing still works; the form submits the typed address with no
  `lat`/`lng`/`placeId`, and the backend geocodes via Nominatim as before.

## 5. Monitoring

- **Console → APIs & Services → Dashboard** — per-API request counts and
  error rates (filter by `geocoding-backend.googleapis.com`,
  `places-backend.googleapis.com`, `maps-backend.googleapis.com`).
- **Console → Billing → Budgets & Alerts** — set a monthly budget (e.g. $10–
  $25 for beta) with email alerts at 50%/90%/100%. The first $200/month of
  Maps Platform usage is covered by Google's standing monthly credit, so a
  small budget alert here is purely a tripwire for unexpected volume, not an
  expected charge.
- **Application logs**: `geocodeAddress()`'s result includes `source: "google" | "nominatim"`
  (Phase 4), logged via `logger.info("parcel.geocode.success", { source, ... })`
  and surfaced as checkpoint `parcel.geocode.success` /
  `parcel.geocode.failed`. A sustained shift from `source: "google"` to
  `source: "nominatim"` in logs is the first signal of a Google-side quota or
  key issue, ahead of any user-visible impact.

## 6. Status checklist

| Item | Status |
|---|---|
| Recommended quota values documented | ✅ Done (this report) |
| Quotas actually configured in Console | ❌ Manual step — requires authenticated `gcloud`/Console access (see Phase 1/2 reports) |
| Budget alert configured | ❌ Manual step — same |
| Code-level fallback on quota exhaustion | ✅ Already implemented (Phase 4 + Phase 5, verified) |
