# Quote Widget Fallback UX Audit

**Date:** 2026-06-11/12
**File audited:** `client/components/sections/QuoteWidgetSection.tsx` (536 lines), compared
against `client/components/sections/AddressCheckerSection.tsx` and
`client/hooks/use-property-lookup.ts`.

---

## The two phases

`QuoteWidgetSection.tsx` is a two-phase widget:

- **`phase === "address"`** (`QuoteWidgetSection.tsx:210-336`) — address form +
  "Get My Price" button. On failure, an inline amber panel appears
  (`:289-329`).
- **`phase === "plans"`** (`:339-530`) — pricing tiles + plan/cadence pickers,
  reached either via a successful lookup or via the amber panel's "See
  Pricing" button.

## Path 1 — `handleSearch` success (`:142-162`)

```ts
const data = await lookup(address, zip, city, stateVal);
if (data) {
  setAcreage(data.acreage);
  setCounty(data.county ?? null);
  setConfidence(data.confidence ?? null);
  setAcreageSource(data.acreageSource ?? null);
  setPhase("plans");
}
```

Any `2xx` response with an `acreage` value — **regardless of its
magnitude** — is treated as success and immediately advances to `phase =
"plans"`. There is **no acreage-magnitude check** here, unlike
`AddressCheckerSection.tsx:108-114`'s `fetchedAcreage > 2` branch.

### Resulting tile rendering for `acreage > 2` (current bug)

`subPriceCents` (`:133`) and `annualPriceCents` (`:134-136`) are computed by
looking up `acreage` in `CADENCE_TIERS` / `ANNUAL_TIERS`, both capped at `max:
2.00`. For `acreage = 21.057` (address B) or `3.959`/`3.352` (D1/D2), **both
lookups return `null`**.

- "Recurring Service" tile (`:380-389`): `priceDisplay: subPriceCents ?
  ... : null` → `null`. The `{priceDisplay && (...)}` block (`:435-445`) does
  not render at all — **the entire price/sub-line area is empty**, but the
  icon, label, "Most popular" badge, and description still render normally.
- "Annual Plan" tile (`:399-408`): same — empty price area, badge "Best
  value" still shown.
- "One-Time Treatment" tile (`:390-398`): `priceDisplay` is the hardcoded
  string `Starting at $175` (`ONE_TIME_CENTS`, not tier-dependent) — **always
  renders**, regardless of acreage.
- Frequency picker (`:464-503`, shown only for `selectedProgram ===
  "subscription"`): each cadence button calls `lookupCadenceCents(days)`
  (`:127-131`) → `null` for `acreage > 2`. The `{p ? (...) : null}` block
  (`:488-495`) means **no price/`+ tax` line renders inside any cadence
  button** — only the label (`"Every 3 wks"`) and note (`"Most popular"`)
  show.
- "Schedule Service" CTA (`:514-528`) remains fully clickable and functional
  regardless — `handleSchedule` doesn't validate `acreage`, so a customer
  *can* still get to scheduling, just without ever seeing a price.

**Net effect:** the page doesn't error, doesn't show a fallback message, and
doesn't block the customer — but for ~30% of the rendered surface (two of
three plan tiles, all four cadence buttons under "Recurring Service") it
silently shows blank space where a price should be. This is the "looks
broken" failure mode named in the mission brief ("Do NOT show empty pricing
cards").

## Path 2 — `handleSearch` failure, `error === "manual_required"` (`:156-158`, `:289-329`)

```ts
} else if (error === "manual_required") {
  setLookupFailed(true);
} else {
  setLookupFailed(true);
}
```

Both branches currently do the same thing (`setLookupFailed(true)`) — the
`manual_required` check exists but doesn't currently change behavior; it's a
placeholder for differentiated copy. The amber panel (`:289-329`) then shows:

- Heading: **"We couldn't auto-detect this property"**
- Body: *"Our parcel database doesn't have a record for this address. Enter
  your lot size below and we'll calculate your exact price."*
- A number input for lot size (acres), placeholder `"e.g. 0.25"`
- A single **"Use 0.25 ac"** quick-fill button (`:312-318`) that just sets
  `manualAcreage = "0.25"` — does not submit
- A **"See Pricing"** button (`:320-327`) → `handleManualProceed` (`:164-172`)

```ts
const handleManualProceed = () => {
  const val = parseFloat(manualAcreage);
  const resolved = !isNaN(val) && val > 0 ? val : 0.25;
  setAcreage(resolved);
  setAcreageSource("manual");
  setConfidence("low");
  setManualAcreage(resolved.toString());
  setPhase("plans");
};
```

If the field is empty/invalid, **defaults silently to 0.25 ac** and proceeds.
This satisfies "frontend fallback must allow customer to continue" (Phase 9
step 7) and "Do NOT show empty pricing cards" for *this* path — 0.25 ac falls
within all tier ranges, so every tile renders a real price.

**Gap:** this generic copy ("couldn't auto-detect... our parcel database
doesn't have a record") is misleading for the post-fix Unit-31 case, where the
address *does* geocode successfully and *does* have a parcel record — it's
just a 21-acre shared/HOA parcel unsuitable for direct per-unit pricing. A
customer seeing "we don't have a record for this address" when their condo
complex clearly exists may be confused or distrustful. This panel's copy
needs a second variant for the "found a parcel, but it's a large
shared/multi-unit property" case (see
[MULTI_UNIT_PROPERTY_RULES_REPORT.md](./MULTI_UNIT_PROPERTY_RULES_REPORT.md)).

## Address/ZIP edit resets (`:230`, `:263`)

```ts
onChange={e => { setAddress(e.target.value); setLookupFailed(false); }}
...
onChange={e => { setZip(e.target.value.replace(/\D/g, "")); setLookupFailed(false); }}
```

Editing the address or ZIP after a failed lookup clears `lookupFailed`,
hiding the amber panel so the user can retry. `manualAcreage` itself is
**not** reset (minor — stale value would just be overwritten if `handleSearch`
succeeds, or reused if the user re-triggers the fallback).

## Comparison: `AddressCheckerSection.tsx`'s "custom" status (`:108-114`, `:342-360`)

This sibling component already has a third outcome the quote widget lacks:

```ts
if (!tier || tier.subscription === "custom" || fetchedAcreage > 2) {
  setResult({ status: "custom", acreage: fetchedAcreage });
}
```

Rendered (`:342-360`) as a distinct card: *"Large Property"* heading,
*"Custom Quote Required"*, `"Your estimate: 21.06 acres. ..."`, and a "Book a
custom consultation" link to `/contact` — **no pricing tiles attempted at
all** for this case. This is the right shape (acreage-gated branch with
dedicated copy + CTA, no broken tile rendering) but its specific CTA
(redirect to `/contact` for a fully custom quote) is heavier than what Phase 9
asks for the quote widget (inline manual-acreage re-entry with 0.05/0.10/0.25
presets, staying in the same self-serve flow).

---

## Does the current fallback UX satisfy Phase 9 steps 7-9?

| Requirement | Current state |
|---|---|
| 7. "Frontend fallback must allow customer to continue" | **Partially.** Satisfied for the `lookupFailed` (422) path via "See Pricing" → 0.25 ac default. **Not satisfied** for the `acreage > 2` success path — customer reaches `phase: "plans"` but sees broken/empty tiles with no guidance on what to do next. |
| 8. "Do NOT show empty pricing cards" | **Violated** for any `acreage > 2` result (addresses B, D1, D2 in the reproduction report) — two of three tiles render with no price, all four cadence buttons render with no price. |
| 9. "Do NOT quote 21-acre HOA parcel as normal subscription pricing" | **Not actively violated today** only because pricing happens to come back `null`/empty for >2 ac — but this is incidental (a side effect of the tier table's `max: 2.00` cap), not a deliberate guard. If the tier tables were ever extended past 2 ac, a 21-acre HOA parcel would be quoted as a single residential property with no safeguard. |

## Conclusion / what the fix needs to add

The amber `lookupFailed` panel (Path 2) is in reasonably good shape — it
already satisfies "allow customer to continue" via a sensible default. The
gap is entirely in **Path 1 for `acreage > 2`**, which needs a new branch
(mirroring `AddressCheckerSection`'s `"custom"` status but with an inline,
self-serve "enter your unit's lot size" form instead of a redirect to
`/contact`):

1. After a successful lookup, check `acreage > 2` (or equivalently the new
   `oversized` flag from `/api/parcel/quote`, since `cadenceOptions` is empty
   exactly when `acreage > 2`).
2. If oversized, do not render the normal plan tiles. Render a dedicated
   panel: explain the address matched a large/shared property record, and
   offer 0.05 / 0.10 / 0.25-acre quick-select presets (Phase 9 step 5) that
   set `acreage` to the chosen value and proceed to normal tile rendering
   (which will then show real prices, since all three presets are ≤ 2 ac).
3. Leave Path 2 (the `lookupFailed`/422 amber panel) largely as-is, but
   differentiate copy if/when the backend can distinguish "no parcel found at
   all" vs. "found a parcel, still no coordinates" — out of scope for this
   sprint (no backend signal currently distinguishes these).

This is detailed as **Option B** in
[QUOTE_FIX_DECISION_MATRIX.md](./QUOTE_FIX_DECISION_MATRIX.md).
