# Quote Fix Decision Matrix

**Date:** 2026-06-11/12

This matrix evaluates candidate fixes against the evidence gathered in Phases
1-7 and the mission's critical constraints (do not assume manual review is
acceptable, do not redesign the parcel system, do not re-enable Regrid by
default unless evidence requires it, preserve county GIS as the acreage
source, smallest correct fix).

---

## Candidate options

| # | Option | Description |
|---|---|---|
| **A** | **Rollback to `/api/regrid/parcel`** | Revert `client/hooks/use-property-lookup.ts` to call the old endpoint (`server/routes/regrid.ts`), restoring the May-12 flow. |
| **B** | **Strip unit/suite suffix before geocoding + oversized-acreage panel** (Phase 9 preferred) | Add `stripUnitSuffix()`; when present, geocode the stripped address (fall back to original if that also fails). Add an `oversized` flag (`acreage > 2.0`) to the API response; frontend shows a manual-lot-size panel with 0.05/0.10/0.25 ac presets instead of broken pricing tiles. |
| **C** | **Enable Google Geocoding API** (`GOOGLE_MAPS_SERVER_KEY`) | Switch `geocodeAddress()` to Google, which handles `subpremise` (unit) components better than Nominatim. |
| **D** | **Re-enable Regrid fallback adapter** | Set `regridFallback` feature flag to `true`, wiring `RegridFallbackAdapter` into `ADAPTER_MAP`. |
| **E** | **Add a dedicated "Apt/Unit/Suite" form field** | New optional input across `QuoteWidgetSection`, `AddressCheckerSection`, `AddPropertyDialog`; send separately, never concatenate into the geocoded string. |
| **F** | **Raise the pricing-tier acreage cap** (e.g. to 25 ac) | Extend `CADENCE_TIERS`/`ANNUAL_TIERS`/`pricingQuote.ts` so `acreage = 21.057` gets a real (extrapolated) per-visit price instead of `null`. |
| **G** | **Generic "Custom Quote Required" redirect for `acreage > 2`** | Mirror `AddressCheckerSection.tsx`'s `"custom"` status exactly — dedicated card + `/contact` link, no inline presets, no further self-serve flow. |
| **H** | **Fix only the oversized-tile bug, leave geocoding as-is** | Apply only the second half of Option B (oversized panel) without unit-suffix stripping. |

---

## Scoring

| Criterion | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| Fixes Unit 31 / `#31` / `Apt 31` → 422 (root issue) | ✅* | ✅ | ✅ (likely) | ❓ untested | ✅ | ❌ | ❌ | ❌ |
| Fixes broken/empty pricing tiles for `acreage > 2` (B/D1/D2) | ❌ | ✅ | ❌ | ❌ | ❌ | ⚠️ (see risk) | ✅ | ✅ |
| Addresses the *actual* root cause (not a workaround) | ❌ | ✅ | ⚠️ partial | ❌ | ✅ | ❌ | n/a | n/a |
| "Smallest correct fix" (minimal diff, no new infra) | ⚠️ | ✅ | ❌ (needs paid key) | ⚠️ | ❌ (new UI field, 3 forms) | ✅ | ✅ | ✅ |
| Preserves county GIS as acreage source | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Avoids re-enabling Regrid without evidence | ✅ | ✅ | ✅ | ❌ **violates constraint** | ✅ | ✅ | ✅ | ✅ |
| Avoids quoting 21-ac HOA parcel as normal residential price | ✅ | ✅ | ❌ **risk** | ❓ | ❌ **risk** | ❌ **violates** | ✅ | ✅ |
| Risk of reintroducing fake/stub data | ❌ **yes** | ✅ none | ✅ none | ✅ none | ✅ none | ✅ none | ✅ none | ✅ none |

\* Option A "fixes" Unit 31 only via the hardcoded substring stub — see below.

---

## Why each rejected option is rejected

**A — Rollback.** Restores the `"22216"`/`"caminito escobedo"` substring stub
— i.e., reintroduces fake `{acreage: 0.07, sqft: 3049}` test data
(`QUOTE_OLD_VS_CURRENT_BEHAVIOR.md`). It "fixes" only this one literal address
string, does nothing for any other condo/unit address, abandons the
production-readiness work (`d83cd9a`), and does not touch the D1/D2
oversized-tile bug (which is independent of the endpoint). Per the mission's
own framing — "if old behavior was better and safe, restore old behavior" —
the old behavior was neither: it was a fabricated value for one hardcoded
string. **Rejected.**

**C — Enable Google Geocoding.** Requires provisioning/spending against a
`GOOGLE_MAPS_SERVER_KEY` — explicitly out of scope to do unilaterally during
an investigation (`GEOCODER_STRATEGY_AUDIT.md`). Even if enabled, Google would
likely still resolve `"22216 Caminito Escobedo, Unit 31"` to the *same
building's* rooftop coordinates → the same 21.057-ac shared parcel → the same
broken-tile bug from Option B's second half would still be needed. Google
fixes geocoding only; it doesn't fix the pricing-tile bug, and it costs money
and a deploy-time config change the mission didn't ask for. **Not adopted as
primary fix** (consistent with the earlier
`PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md` "Clarification"
section — Google remains a valid *future* enhancement, not a requirement).

**D — Re-enable Regrid fallback.** Directly contradicts the explicit
constraint: *"Do NOT re-enable Regrid by default unless evidence shows it is
the only safe rollback."* No evidence supports this — Regrid was never in this
address's path even historically (the stub intercepted it first), so
re-enabling it cannot "restore" anything, and it doesn't address the
unit-suffix geocoding failure (the `RegridFallbackAdapter` is only reached
*after* a successful geocode in the current pipeline, per
`parcelLookupService.ts`). **Rejected outright per constraint.**

**E — Dedicated Apt/Unit field.** A genuinely good long-term UX improvement
(noted as a follow-up in `ADDRESS_NORMALIZATION_AUDIT.md`), but: requires new
UI across three forms, type/schema changes, and migration of existing
customer data; doesn't help any customer who already has a unit number typed
inline (the overwhelming majority, including this exact bug report); and does
nothing for the D1/D2 oversized-tile bug, which has nothing to do with units.
Too large for "smallest correct fix," and incomplete on its own. **Deferred as
follow-up, not the fix.**

**F — Raise the acreage cap.** Would produce a *real, non-null* per-visit
price for `acreage = 21.057` by extrapolating the tier table — e.g. a
"$2,000+/visit" recurring price for an individual condo unit. This is exactly
the failure mode the mission explicitly forbids: *"Do NOT quote a 21-acre HOA
parcel as normal residential subscription pricing."* Pricing tiles would no
longer be *empty*, but they'd be *wrong* — arguably worse, since a wrong price
looks authoritative. **Rejected.**

**G — Generic "Custom Quote Required" redirect.** Functionally safe (matches
`AddressCheckerSection.tsx`'s existing `"custom"` branch) and would satisfy
"don't show empty tiles" and "don't quote 21ac as residential." However, it
fails Phase 9 step 7 in its *intended* sense — it exits the self-serve quote
flow entirely (redirect to `/contact`, no price shown at all) for what, after
unit-stripping, will be the **majority of condo/townhome quote attempts**.
Phase 9 explicitly specifies inline 0.05/0.10/0.25-ac presets precisely so
these customers get an instant price like everyone else. **Superseded by
Option B**, which achieves the same safety without the UX regression.

**H — Oversized-panel fix only, no unit-suffix stripping.** This alone would
fix D1/D2 (broken tiles → manual-entry panel) but would leave **all
unit-suffixed addresses still returning 422** with the generic "couldn't
auto-detect this property" amber panel — i.e., Unit 31 still wouldn't reach
the new oversized panel at all, because it never geocodes. This does not
satisfy the mission's primary ask ("restores customer quote functionality" for
*this* address). **Insufficient alone — but its oversized-panel logic is
exactly the second half of Option B.**

---

## Recommendation: Option B

Option B is the union of:

- **B1 (geocoding fix):** `stripUnitSuffix()` in
  `googleAddressService.ts`, applied in `parcelLookupService.ts`'s geocoding
  step — converts Unit 31/`#31`/`Apt 31`/no-comma variants from `422
  MANUAL_REVIEW_REQUIRED` to `200` with `acreage = 21.057` (same result as the
  no-unit address, confirmed in `QUOTE_REPRODUCTION_REPORT.md`).
- **B2 (oversized-acreage panel):** `oversized` flag in
  `server/routes/parcelQuote.ts` (`acreage > 2.0` ⟺ empty
  `cadenceOptions`), surfaced through `use-property-lookup.ts`, and a new
  branch in `QuoteWidgetSection.tsx` that — instead of broken tiles — shows a
  "shared/large property" panel with 0.05/0.10/0.25-ac presets feeding back
  into the normal tile rendering.

B1 alone reproduces the *old, incorrect* "0.07 acres, looks fine" experience's
*symptom* (a 200 response) but with **correct** data (21.057 ac, the real
shared parcel) — which, without B2, would trigger the *already-existing*
broken-tile bug (B2's problem) for this address. B2 alone doesn't fix the 422.
**Both halves are required** to satisfy "restores customer quote functionality
without producing bad acreage/pricing" — this is not scope creep, it's the
two halves of one causal chain revealed by the same root-cause investigation
(confirmed independently via D1/D2, which have nothing to do with units).

This combination:
- Touches only `googleAddressService.ts`, `parcelLookupService.ts`,
  `parcelQuote.ts`, `use-property-lookup.ts`, and
  `QuoteWidgetSection.tsx` — no schema changes, no new env vars/infra, no
  changes to county adapters, caching, or the Regrid/SCAG code paths.
- Requires no new feature flags (the existing `parcelCountyLookup`/
  `regridFallback` flags are untouched).
- Is fully covered by the existing `.spec.ts` test convention (new unit tests
  for `stripUnitSuffix` and the `oversized` flag).

See [QUOTE_FIX_IMPLEMENTATION_REPORT.md](./QUOTE_FIX_IMPLEMENTATION_REPORT.md)
for the implementation and
[QUOTE_FIX_VALIDATION_REPORT.md](./QUOTE_FIX_VALIDATION_REPORT.md) for
validation results.
