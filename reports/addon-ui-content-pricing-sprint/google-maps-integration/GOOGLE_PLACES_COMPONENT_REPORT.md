# Phase 5 — Frontend Places Autocomplete Component

## Status: ✅ Complete

Three new files were added. No existing files were modified in this phase
(wiring into forms is Phase 6).

## Files created

### 1. `client/types/google-maps.d.ts`

Self-contained ambient TypeScript declarations for the small subset of the
Google Maps JavaScript API (Places library, legacy `Autocomplete` class) that
the new component uses:

- `GooglePlaceAddressComponent`, `GooglePlaceResult`, `GoogleAutocompleteInstance`
- `Window.google.maps.places.Autocomplete`, `Window.google.maps.LatLngBounds`,
  `Window.google.maps.event.clearInstanceListeners`

This avoids adding the `@types/google.maps` package (no `package.json` /
lockfile churn) while still giving full type-checking for the fields actually
used. Follows the same `declare global { interface Window { ... } }` pattern
already used by `client/components/common/ChatWidget.tsx` for `window.$crisp`
— TypeScript merges both augmentations of `Window` without conflict (verified
by `npm run typecheck`).

### 2. `client/lib/googleMapsLoader.ts`

- **`loadGoogleMapsScript(apiKey: string): Promise<void>`** — injects
  `<script src="https://maps.googleapis.com/maps/api/js?key=...&libraries=places&loading=async">`
  exactly once (module-level promise cache; checks `window.google?.maps?.places`
  first; reuses an already-present `<script id="google-maps-places-script">`
  tag if one exists).
- **`useGoogleMapsScript(): "idle" | "loading" | "ready" | "error"`** — React
  hook that reads `import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY`:
  - No key configured → `"idle"` (component renders as a plain input, no
    network request is made).
  - Key present → `"loading"` while the script loads, `"ready"` on success,
    `"error"` if the script fails (e.g. bad/restricted key).

### 3. `client/components/common/GoogleAddressAutocomplete.tsx`

Reusable, drop-in replacement for a plain street-address `<input>`:

```ts
export type GoogleAddressAutocompleteResult = {
  formattedAddress: string;
  streetAddress: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat: number;
  lng: number;
  placeId?: string;
};

export interface GoogleAddressAutocompleteProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: GoogleAddressAutocompleteResult) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  error?: string;
  required?: boolean;
}
```

Behavior:

- **Always renders** the existing shadcn `<Input>` component, fully
  controlled (`value`/`onChange`) — manual typing works identically to a
  plain `<input>` regardless of Google's availability. This is the
  "manual fallback" required by the spec: if the script never loads
  (`"idle"` or `"error"`), the field is indistinguishable from before.
- Only when `useGoogleMapsScript()` reports `"ready"` does it attach
  `new google.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: "us" }, fields: [...] })`.
- Biases (does not hard-restrict) suggestions to California via
  `autocomplete.setBounds(new google.maps.LatLngBounds(sw, ne))` with
  `sw = {32.5121, -124.6509}`, `ne = {42.0095, -114.1315}`.
- On `place_changed`, parses `address_components` into `street_number` +
  `route` (→ `streetAddress`), `subpremise` (→ `unit`), `locality`/`sublocality`
  (→ `city`), `administrative_area_level_1` short name (→ `state`),
  `postal_code` (→ `zip`), plus `geometry.location.lat()/lng()` and
  `place_id`/`formatted_address`. Calls `onChange(streetAddress)` (so the
  visible field shows just the street address, not the unit/city/state) and
  `onPlaceSelect(result)` with the full structured result.
- Accessible: renders a `<Label htmlFor>` when `label` is provided, sets
  `aria-invalid`/`aria-describedby` and renders an error message when `error`
  is provided — matching patterns already used elsewhere in the codebase.
- Mobile-friendly: it's a standard text `<input>`; Google's own
  `.pac-container` dropdown handles touch interaction with no custom UI
  needed.
- Cleans up: on unmount or when the script status changes, calls
  `google.maps.event.clearInstanceListeners(autocomplete)`.

## Validation

- `npm run typecheck` → **exit code 0**, no errors (including the new
  ambient `Window.google` augmentation alongside the existing `Window.$crisp`
  augmentation in `ChatWidget.tsx`).
- No existing files were touched, so no risk of regression yet — this phase
  only adds new, unused-until-wired files.

## Next step (Phase 6)

Wire `<GoogleAddressAutocomplete>` into:
- `client/components/sections/QuoteWidgetSection.tsx`
- `client/components/sections/AddressCheckerSection.tsx`
- `AddPropertyDialog.tsx`
- ScheduleFlow's property step (if it has its own address input)

passing the resulting `lat`/`lng`/`placeId` through to
`usePropertyLookup().lookup(...)`, whose signature already accepts these
optional parameters.
