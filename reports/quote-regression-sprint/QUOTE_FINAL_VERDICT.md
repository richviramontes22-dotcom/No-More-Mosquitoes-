# Quote/Acreage Regression — Final Verdict

**Date:** 2026-06-12
**Reported issue:** `22216 Caminito Escobedo, Unit 31, Laguna Hills, CA
92692` returns `422 MANUAL_REVIEW_REQUIRED` from the public quote tool,
where the user says it "previously worked."

This report synthesizes
[QUOTE_REGRESSION_TIMELINE.md](./QUOTE_REGRESSION_TIMELINE.md),
[QUOTE_OLD_VS_CURRENT_BEHAVIOR.md](./QUOTE_OLD_VS_CURRENT_BEHAVIOR.md),
[QUOTE_REPRODUCTION_REPORT.md](./QUOTE_REPRODUCTION_REPORT.md),
[ADDRESS_NORMALIZATION_AUDIT.md](./ADDRESS_NORMALIZATION_AUDIT.md),
[GEOCODER_STRATEGY_AUDIT.md](./GEOCODER_STRATEGY_AUDIT.md),
[MULTI_UNIT_PROPERTY_RULES_REPORT.md](./MULTI_UNIT_PROPERTY_RULES_REPORT.md),
[QUOTE_FALLBACK_UX_AUDIT.md](./QUOTE_FALLBACK_UX_AUDIT.md),
[QUOTE_FIX_DECISION_MATRIX.md](./QUOTE_FIX_DECISION_MATRIX.md),
[QUOTE_FIX_IMPLEMENTATION_REPORT.md](./QUOTE_FIX_IMPLEMENTATION_REPORT.md), and
[QUOTE_FIX_VALIDATION_REPORT.md](./QUOTE_FIX_VALIDATION_REPORT.md) into direct
answers to the questions the sprint was opened to resolve.

---

## What changed?

**Exactly one commit**, `d83cd9a` ("Production readiness sprint", 2026-06-08),
repointed the quote widget's lookup call
(`client/hooks/use-property-lookup.ts`) from the old
`POST /api/regrid/parcel` endpoint to a brand-new `POST /api/parcel/quote`
endpoint backed by 1,742 lines of new code: real OSM Nominatim geocoding,
county detection, and live ArcGIS county-GIS parcel lookups
(`server/services/parcel/**`). No commit since then touched this logic.

## Why did it work before?

**It didn't — not in any real sense.** The old `/api/regrid/parcel` route
contained a hardcoded developer stub (`server/routes/regrid.ts:48-52`, present
since the route was first added) that special-cased any address containing
`"22216"` or `"caminito escobedo"` and returned a fixed
`{ acreage: 0.07, sqft: 3049 }` *before any geocoder or external API call*.
Every variant of this address — with or without `Unit 31`, `#31`, `Apt 31` —
hit this stub and got the same fabricated (if plausible) answer. The address
"worked" because real lookups were never attempted for it.

## Why does it fail now?

The new `/api/parcel/quote` pipeline has no such stub. It sends the full
address string, **including `Unit 31`**, to OSM Nominatim. Nominatim — like
virtually all free US geocoders — cannot resolve unit/apartment/suite-level
addresses and returns zero results for `Unit 31`, `#31`, `Apt 31`, and `Unit
31` (no comma) alike
([GEOCODER_STRATEGY_AUDIT.md](./GEOCODER_STRATEGY_AUDIT.md),
[QUOTE_REPRODUCTION_REPORT.md](./QUOTE_REPRODUCTION_REPORT.md)). With no
coordinates, the lookup can't reach the county GIS adapter and correctly falls
back to `MANUAL_REVIEW_REQUIRED` → `422`.

A second, independent issue was found in the same investigation: the **no-unit**
version of this address (`22216 Caminito Escobedo`) *did* geocode successfully
— to a real 21.057-acre HOA/shared parcel (APN `588-041-06`) — but the pricing
tier tables are capped at 2.00 acres, so the frontend rendered **empty
subscription/annual pricing tiles** for this and any other `>2`-acre parcel
(also reproduced for two non-condo Orange County civic-center addresses, D1 =
3.959 ac and D2 = 3.352 ac).

## Was the current behavior necessary / was it intentional?

- The endpoint swap itself (stub → real GIS) was **intentional and correct** —
  it was the explicit goal of the "production readiness sprint," and shipping
  a hardcoded fake answer for one address is not production-viable.
- The specific consequence — that *this* address now exercises a real
  geocoder edge case the stub had always masked — was **almost certainly not
  evaluated**. There is no commit message, comment, or design doc indicating
  anyone decided "unit-numbered addresses should require manual review."
- Given Nominatim's well-documented limitation
  ([GEOCODER_STRATEGY_AUDIT.md](./GEOCODER_STRATEGY_AUDIT.md)), `422
  MANUAL_REVIEW_REQUIRED` was the **correct, designed fallback** for "geocoder
  returned nothing" — it was not overly aggressive *given that input*. But it
  was **avoidable**: the underlying building/parcel is locatable once the unit
  suffix is removed for geocoding purposes, and the empty-tile bug for
  `acreage > 2` was a genuine UX bug independent of the unit-suffix issue.

**Conclusion: the regression was an accidental (not malicious, not
deliberately-designed) side effect of removing fake test data, compounded by a
pre-existing `acreage > 2` pricing-tile bug that this address also happens to
trigger.** Both were fixable without reintroducing fake data or rolling back
the production-readiness work.

## What fix was applied?

Per [QUOTE_FIX_DECISION_MATRIX.md](./QUOTE_FIX_DECISION_MATRIX.md) (Option B),
two complementary changes — both required together, neither sufficient alone:

**B1 — geocoding fallback (`server/services/parcel/googleAddressService.ts`,
`server/services/parcel/parcelLookupService.ts`):** new exported
`stripUnitSuffix()` helper strips a trailing `Unit`/`Apt`/`Apartment`/`Suite`/`Ste`/`Bldg`/`Building`/`#`
designator. If the full address fails to geocode **and** it had such a suffix,
the lookup retries geocoding with the suffix stripped. The customer's full
entered address (with "Unit 31") is unchanged everywhere else — it's still
what's sent to the API, stored for the property record, and used for cache
keying. Only the *geocoder* call uses the stripped string, and only as a
fallback.

**B2 — oversized-parcel panel (`server/routes/parcelQuote.ts`,
`client/hooks/use-property-lookup.ts`,
`client/components/sections/QuoteWidgetSection.tsx`):** the API now returns an
`oversized: boolean` flag (`acreage > 2.0`, matching the existing
`CADENCE_TIERS`/`ANNUAL_TIERS` cap and the precedent in
`AddressCheckerSection.tsx`). When `oversized` is true, the widget shows a new
"This looks like a shared or multi-unit property" panel — explaining the
matched record's acreage and offering 0.05/0.10/0.25-acre presets plus a
free-entry field (capped at 2 ac) — instead of the broken/empty pricing tiles.
This is intentionally **not** limited to addresses with a unit suffix: D1/D2
(civic centers, no unit suffix, `>2` ac) proved the empty-tile bug is a general
`acreage > 2` problem, so
[MULTI_UNIT_PROPERTY_RULES_REPORT.md](./MULTI_UNIT_PROPERTY_RULES_REPORT.md)
formalized the broader rule — a documented, evidence-based broadening from
Phase 9's original "AND had a unit suffix" wording.

A new 7-case unit-test file
(`server/services/parcel/googleAddressService.spec.ts`) covers
`stripUnitSuffix()`.

**Explicitly not done** (per the mission's constraints): Regrid was not
re-enabled (`flags.regridFallback()` still defaults `false`,
`RegridFallbackAdapter` still not in `ADAPTER_MAP`); no county adapter,
caching, feature-flag, pricing-tier, or database changes; `AddressCheckerSection.tsx`/`AddPropertyDialog.tsx` not modified (they
inherit the B1 fix for free via the shared `usePropertyLookup` hook and
already have their own `>2 ac → "custom"` handling).

## Did the fix restore functionality?

**Yes**, confirmed in
[QUOTE_FIX_VALIDATION_REPORT.md](./QUOTE_FIX_VALIDATION_REPORT.md):

- `npm run typecheck`, `npm run test` (16/16), and `npm run build` (client +
  server) all pass cleanly with no new warnings.
- The reproduction script (`scripts/test-quote-regression.ts`) shows A/C1/C2/C3
  (Unit 31, `#31`, `Apt 31`, `Unit 31` no comma) — previously all `422
  MANUAL_REVIEW_REQUIRED` — now return `200 OK` with `acreage = 21.057`,
  `apn = 588-041-06`, identical to the no-unit address B.
- A live `/api/parcel/quote` call against the running dev server for the exact
  reported address
  (`22216 Caminito Escobedo, Unit 31, Laguna Hills, CA 92692`) returns `200`
  with `oversized: true` — the new manual-entry panel will render instead of
  empty tiles.
- Out-of-area addresses are unaffected: still `422
  MANUAL_REVIEW_REQUIRED`/"outside our supported service area," same as
  before.

## Does the quote tool now work for multi-unit addresses?

**Yes, for the class of issue found here.** A customer entering
`22216 Caminito Escobedo, Unit 31, Laguna Hills, CA 92692` (or `#31`/`Apt
31`/`Unit 31` without a comma) will now:

1. Geocode successfully (via the stripped-suffix retry) to the same building
   as the no-unit address.
2. Resolve via county GIS to the real 21.057-acre HOA/shared parcel
   (`apn = 588-041-06`).
3. See the new "shared or multi-unit property" panel (since `21.057 > 2`)
   instead of a 422 error or empty pricing tiles.
4. Pick a preset (0.05/0.10/0.25 ac) or enter their own unit's approximate
   size, and immediately see real, priced subscription/annual/one-time tiles
   for that size.

The customer's full entered address — including "Unit 31" — is preserved for
their property record throughout. County GIS remains the sole acreage source
for the underlying parcel; the manual entry only sets the *treatment-area*
size used for pricing, exactly as `AddressCheckerSection.tsx` already does for
its own oversized-parcel case.

This also incidentally fixes the same empty-tile bug for the **no-unit**
version of this address and for any other `>2`-acre parcel (D1, D2, and any
future address that resolves to a large/shared lot) — none of which require a
unit suffix to trigger the bug.

## Remaining risks

1. **Nominatim availability is an external dependency, unchanged by this
   fix.** During validation, `nominatim.openstreetmap.org` was observed to be
   transiently unreachable twice (connection failures/timeouts, not
   429/403 rate-limit responses) and recovered on its own each time. When
   Nominatim is down, **both** the original and the stripped-suffix geocode
   attempts fail, and the lookup correctly falls back to
   `MANUAL_REVIEW_REQUIRED` — for *every* address, not just unit-suffixed
   ones. This is the system's pre-existing designed behavior for "geocoder
   unavailable" and is not something this fix changes or could reasonably
   change within its scope. If Nominatim's reliability becomes an ongoing
   problem, the previously-rejected options in
   [QUOTE_FIX_DECISION_MATRIX.md](./QUOTE_FIX_DECISION_MATRIX.md) (e.g.,
   Option C — paid Google Geocoding key) remain available as a *separate*
   future decision, not part of this fix.

2. **`stripUnitSuffix()` is a heuristic regex.** It correctly handles the
   `#`/`Unit`/`Apt`/`Apartment`/`Suite`/`Ste`/`Bldg`/`Building` patterns tested
   in `googleAddressService.spec.ts` and reproduced in this investigation, but
   an address whose street name itself ends in a word matching this pattern
   (uncommon, but not impossible) could theoretically have its last token
   stripped unnecessarily. In that case the *stripped* geocode would simply
   also fail (returning to the pre-fix `MANUAL_REVIEW_REQUIRED` fallback) —
   it cannot produce a *worse* outcome than before, since stripping is only
   attempted after the full address has already failed to geocode.

3. **The `oversized` panel's presets (0.05/0.10/0.25 ac) and free-entry cap
   (2 ac) are reasonable defaults but not data-driven.** They match the
   existing precedent values used elsewhere
   ([MULTI_UNIT_PROPERTY_RULES_REPORT.md](./MULTI_UNIT_PROPERTY_RULES_REPORT.md)),
   but if real customer usage shows most multi-unit customers need a
   different range, the presets/cap can be tuned later — this is a UI-only
   constant, not a structural risk.

4. **Client-side interaction/visual verification (button clicks, mobile
   layout) was not performed in an actual browser** — this environment has no
   browser automation. All server-driven branching (the part of the fix that
   actually resolves the reported 422) was verified via live API calls; the
   purely client-side rendering was verified via successful type-check/build
   and code review only. See
   [QUOTE_FIX_VALIDATION_REPORT.md](./QUOTE_FIX_VALIDATION_REPORT.md) §4 for
   the per-scenario breakdown.

## Bottom line

The 422 was an accidental side effect of a legitimate cleanup (removing a
hardcoded test stub), not a deliberate or "correct" rejection of multi-unit
addresses, and not something requiring a rollback or a redesign. The smallest
correct fix — strip the unit suffix only for geocoding, and stop rendering
empty pricing tiles for any parcel over the existing 2-acre tier cap — restores
working quotes for the reported address (and its `#`/`Apt`/no-comma variants),
fixes the same latent bug for the no-unit version and other large parcels,
preserves county GIS as the acreage source and the customer's entered address
for records, and does not touch Regrid, feature flags, caching, or pricing
tiers.
