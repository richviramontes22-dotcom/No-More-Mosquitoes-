# Phase 6 — Wire Google Places Autocomplete into Forms

## Status: ✅ Complete

`<GoogleAddressAutocomplete>` (from Phase 5) replaces the plain street-address
`<input>` in all three required forms. In every case, manual typing continues
to work exactly as before — the component only *adds* the Google suggestion
dropdown and the lat/lng/placeId capture when the script is configured and
loaded.

## 1. `client/components/sections/QuoteWidgetSection.tsx`

- Added `lat`, `lng`, `placeId` state (all `undefined` initially).
- New `handlePlaceSelect(result)`: sets `address` to `result.streetAddress`,
  fills `city`/`stateVal`/`zip` from the place (only if Google returned a
  value), and stores `lat`/`lng`/`placeId`.
- The Street Address `<input>` is now `<GoogleAddressAutocomplete>`. Its
  `onChange` (manual typing) clears `lat`/`lng`/`placeId` — so if the
  customer edits the address after picking a suggestion, the backend
  re-geocodes rather than using stale coordinates.
- `handleSearch` now calls
  `lookup(address, zip, city, stateVal, lat, lng, placeId)` — previously
  `lookup(address, zip, city, stateVal)`.
- Styling: `className={`${inputCls} h-auto`}` — `h-auto` overrides the
  shadcn `Input`'s default `h-10` so it matches the existing
  padding-driven (`py-3`) height of the other fields in this form
  (twMerge resolves the `h-10`/`h-auto` conflict).

## 2. `client/components/sections/AddressCheckerSection.tsx`

- Added the same `lat`/`lng`/`placeId` state.
- New `handlePlaceSelect(place)`: same pattern — fills `address`, `city`,
  `state`, `zip`, `lat`, `lng`, `placeId`.
- The "Property Address" field is now `<GoogleAddressAutocomplete>` (manual
  edits clear `lat`/`lng`/`placeId`, same as above). `required` is still
  forwarded to the underlying `<Input>` so the existing HTML5 validation on
  this field is preserved (see Phase 5 component update below).
- `handleSubmit` now calls
  `lookup(address, normalizedZip, city, state, lat, lng, placeId)`.
- This section's result-classification logic (`in_area` / `custom` /
  `out_of_area`, the `fetchedAcreage > 2 → "custom"` rule) is unchanged —
  it only consumes `data.acreage`, which `usePropertyLookup` still returns
  identically.

## 3. `client/components/dashboard/properties/AddPropertyDialog.tsx`

- Added `lat`/`lng`/`placeId` state, reset to `undefined` whenever the
  dialog opens (both add and edit modes — edit mode has no coordinates to
  pre-fill from the `property` prop, since `properties.lat`/`lng` aren't
  currently fetched into this component).
- New `handlePlaceSelect(place)` — same pattern as the other two forms.
- The "Street Address" field is now `<GoogleAddressAutocomplete>`; manual
  edits clear `lat`/`lng`/`placeId`.
- `handleLookup` (the "Auto-detect lot size" button) now calls
  `lookup(address, zip, city, stateVal, lat, lng, placeId)`.

## 4. ScheduleFlow property step

`client/components/schedule/ScheduleFlow.tsx`'s `"property"` step does **not**
have its own address input — it shows a list of the user's saved properties
and an "Add another location" button that opens `AddPropertyDialog` (#3
above). Wiring `AddPropertyDialog` therefore covers this step; no separate
changes were needed in `ScheduleFlow.tsx`.

## Phase 5 follow-up fix

While wiring `AddressCheckerSection.tsx` (whose address field has the native
`required` attribute for HTML5 form validation), found that
`GoogleAddressAutocomplete` accepted a `required` prop but only used it to
render the label's `*` — it wasn't forwarded to the underlying `<Input>`.
Added `required={required}` to the rendered `<Input>` in
`client/components/common/GoogleAddressAutocomplete.tsx` so existing
`required`-field behavior is preserved everywhere the component is used.

## Validation

- `npm run typecheck` → **exit code 0** after all edits above.
- No changes to `usePropertyLookup`, `parcelLookupService`, or pricing logic
  in this phase — purely additive UI wiring. Manual-fallback path (Google
  script absent/erroring → plain `<Input>`, no autocomplete dropdown, no
  lat/lng/placeId sent) is unchanged from pre-Phase-5 behavior since
  `lat`/`lng`/`placeId` simply stay `undefined` and `lookupParcel` falls back
  to its existing Nominatim/stripUnitSuffix geocoding path (Phase 4).
