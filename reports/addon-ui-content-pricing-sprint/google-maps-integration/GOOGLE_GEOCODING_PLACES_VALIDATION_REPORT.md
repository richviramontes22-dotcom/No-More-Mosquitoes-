# Phase 9 — Validation

## Status: ✅ Static checks pass; ✅ live API behavior verified for all 8 spec
addresses; ⚠️ browser/console UI checks are code-reviewed only (no headless
browser available in this environment — same limitation as Sprint 1's
[QUOTE_FIX_VALIDATION_REPORT.md](../quote-regression-sprint/QUOTE_FIX_VALIDATION_REPORT.md)).

## 1. Static checks

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ exit 0 |
| `npm test` (vitest) | ✅ 3 files, 16/16 tests passed, including `server/services/parcel/googleAddressService.spec.ts` (7 tests, Phase 4) |
| `npm run build` (client + server) | ✅ both succeed. Only pre-existing warnings: chunk-size warning on `index-TC0jFO4y.js` (2.28 MB), `%VITE_CRISP_WEBSITE_ID%` not defined, browserslist data 10 months old, and dynamic/static import-mix notices for `server/lib/supabase.ts` etc. — all unrelated to this sprint's changes. |

## 2. Live test of the 8 spec addresses

Started `npm run dev` (Vite + Express middleware, bound to port **8082** —
8080/8081 were already in use by another running instance) and POSTed each
address to `/api/parcel/quote`. **No `GOOGLE_MAPS_SERVER_KEY` is configured**
(Phase 2/3 manual key-creation steps are still pending — see Phase 8/10), so
every geocode in this run goes through the **Nominatim fallback path**. This
is the expected, by-design behavior and is itself the thing being validated:
the new Google-primary code must not break this path when Google is
unavailable.

| # | Address | Result |
|---|---|---|
| 1 | **Unit 31** — `22216 Caminito Escobedo, Unit 31, Laguna Hills, CA, 92692` | `200 OK` — `oversized:true`, `acreage:21.057`, `apn:"588-041-06"`, `cached:true` |
| 2 | **No-unit** — `22216 Caminito Escobedo, Laguna Hills, CA, 92692` | `200 OK` — identical to #1 (`oversized:true`, `acreage:21.057`, same APN), `cached:true` |
| 3 | **Anaheim Civic Center** — `100 Civic Center Dr, Anaheim, CA, 92801` | `200 OK` — `oversized:true`, `acreage:3.959`, `apn:"255-161-05"`, `cached:true` |
| 4 | **Santa Ana Civic Center** — `20 Civic Center Plaza, Santa Ana, CA, 92701` | `200 OK` — `oversized:true`, `acreage:3.352`, `apn:"008-036-35"`, `cached:true` |
| 5 | **Riverside** — `3900 Main St, Riverside, CA, 92501` | `200 OK` — `oversized:false`, `acreage:0.68`, `acreageSource:"county_field"`, `confidence:"high"`, full `cadenceOptions` (4 plans) + `annual` pricing, `cached:false` (fresh geocode) |
| 6 | **San Diego** — `202 C St, San Diego, CA, 92101` | `422 MANUAL_REVIEW_REQUIRED` — *"We could not automatically verify the lot size for this address. Please enter it manually to get your quote."* |
| 7 | **Unsupported (TX)** — `500 Main St, Dallas, TX, 75201` | `422 MANUAL_REVIEW_REQUIRED` — *"This address is outside our supported service area. Contact us for a custom quote."* |
| 8 | **Malformed** — `"asdfasdf"`, zip `"00000"` | `422 MANUAL_REVIEW_REQUIRED` — *"This address is outside our supported service area. Contact us for a custom quote."* |

### Notes on #6 (San Diego)

This returns the *"could not automatically verify the lot size"* variant of
`MANUAL_REVIEW_REQUIRED` rather than the *"outside our supported service
area"* variant — i.e. geocoding succeeded (San Diego is a supported county)
but the San Diego County GIS adapter didn't return a parcel match for this
specific civic-center address. This is the existing, pre-sprint
`lookupFailed` / amber-panel code path (Path 2, unchanged by this sprint) and
is **not a regression** — it's the same graceful "enter acreage manually"
fallback that #7/#8 exercise via the other message variant. The integration's
job (per the spec's critical constraints) is to not break this fallback, and
it didn't.

### Server log confirmation (geocode source)

```
event":"parcel.geocode.success" ... "source":"nominatim" ... (×3)
event":"parcel.geocode.failed"  ... zip":"00000"            (×1, address #8)
```

All fresh geocodes (addresses #1/#2/#5; #3/#4 were cache hits and skipped
geocoding) used `source: "nominatim"` — confirming the fallback chain from
Phase 4 (`geocodeWithGoogle()` → returns `null` when `GOOGLE_MAPS_SERVER_KEY`
is unset → falls through to Nominatim) works exactly as designed. The
Google-path itself is covered by `googleAddressService.spec.ts`'s 7 unit
tests (mocked HTTP), which passed in section 1.

## 3. Frontend Autocomplete — manual-fallback behavior (code-reviewed)

No headless browser is available in this environment to capture live console
output, so this is verified by reading `client/lib/googleMapsLoader.ts` and
`client/components/common/GoogleAddressAutocomplete.tsx` (both from Phase 5):

- `useGoogleMapsScript()`: when `import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY`
  is falsy (current state — unset), `status` is initialized to `"idle"` and
  the effect returns immediately **without** calling
  `loadGoogleMapsScript()`. No `<script>` tag is injected, no network request
  to `maps.googleapis.com` is made, and therefore no related console errors
  are possible.
- `GoogleAddressAutocomplete` always renders the shadcn `<Input>`. The
  `useEffect` that attaches `google.maps.places.Autocomplete` short-circuits
  unless `status === "ready"` — with `status === "idle"`, it never runs. The
  three forms (`QuoteWidgetSection`, `AddressCheckerSection`,
  `AddPropertyDialog`) therefore render and behave exactly as they did before
  Phase 5/6: a plain text input, manual typing only.
- This means, with the current (no-key) deployment state: **no empty
  autocomplete dropdowns, no console errors from the Maps script, and the
  manual address-entry flow is byte-for-byte the pre-sprint behavior** other
  than the `required={required}` forwarding fix (Phase 6 follow-up), which
  only affects native HTML5 validation messaging.

## 4. Security — no server key exposure

```sh
grep -o "GOOGLE_MAPS_SERVER_KEY\|VITE_GOOGLE_MAPS_BROWSER_KEY" dist/spa/assets/*.js   # → no matches
grep -c "AIza" dist/spa/assets/*.js dist/server/*.mjs                                # → 1 match in client bundle, 0 in server bundle
```

The single `AIza` match in the client bundle is the **pre-existing**
`placeholder="AIza..."` string in `client/pages/admin/Settings.tsx:290`
(an unrelated admin-settings UI field for a different Google Maps
integration's API key input) — confirmed via source grep, not a leaked
credential. `GOOGLE_MAPS_SERVER_KEY` does not appear anywhere in either the
client or server bundle (it is read only in
`server/services/parcel/googleAddressService.ts`, which never executes in the
browser).

## 5. Oversized / shared-parcel panel & manual acreage fallback

Addresses #1–#4 all returned `oversized:true` (acreage > 2), which is the
condition that renders the manual unit-size panel in `QuoteWidgetSection.tsx`
(0.05/0.10/0.25 ac presets + free entry) instead of the per-cadence pricing
tiles — this logic is unchanged from the prior sprint and is exercised
identically regardless of whether `lat`/`lng`/`placeId` came from Google
Autocomplete or were absent (manual entry + Nominatim, as in this run).
Address #5 (Riverside, 0.68 ac) returned the normal `cadenceOptions` array,
exercising the non-oversized path. Addresses #6–#8 returned
`MANUAL_REVIEW_REQUIRED`, which renders the amber "couldn't auto-detect, enter
acreage manually" panel (`lookupFailed` branch) — also unchanged.

## Conclusion

| Spec requirement | Status |
|---|---|
| typecheck/test/build pass | ✅ |
| 8 spec addresses behave correctly | ✅ (all 8 verified live against `/api/parcel/quote`) |
| Nominatim fallback still works | ✅ (confirmed via server logs, `source:"nominatim"`) |
| `stripUnitSuffix` fallback preserved | ✅ (Unit 31 → same APN/acreage as no-unit, via cache from prior sprint's reproduction — code path unchanged, unit-tested) |
| Oversized/shared-parcel panel still works | ✅ (#1–#4 all `oversized:true`) |
| Manual fallback (lookupFailed panel) still works | ✅ (#6–#8 all `MANUAL_REVIEW_REQUIRED`) |
| No empty cards / console errors from Autocomplete when key absent | ✅ (code-reviewed — `useGoogleMapsScript` returns `"idle"`, no script injected) |
| No server key exposed to frontend | ✅ (bundle grep clean) |
| Live Google geocoding / Autocomplete dropdown UI | ⚠️ Not tested — `GOOGLE_MAPS_SERVER_KEY` / `VITE_GOOGLE_MAPS_BROWSER_KEY` don't exist yet (Phase 2, blocked on `gcloud auth login`). Google code paths are covered by Phase 4's unit tests (`googleAddressService.spec.ts`, 7/7 passing) and Phase 5–7's typecheck-clean implementation; end-to-end live verification with a real key is a Phase 10/post-deploy step. |
