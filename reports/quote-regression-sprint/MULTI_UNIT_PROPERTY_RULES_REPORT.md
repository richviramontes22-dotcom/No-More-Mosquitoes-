# Multi-Unit / Condo / Shared-Parcel Business Rules

**Date:** 2026-06-11/12

---

## Current behavior (pre-fix)

| Address type | Geocode | Parcel result | UI outcome |
|---|---|---|---|
| Single-family home, normal address | OK | acreage ≤ 2.0 | Normal "plans" screen with priced tiles |
| Condo/apt with `Unit`/`Apt`/`#` suffix | **fails** (Nominatim) | never reached | `MANUAL_REVIEW_REQUIRED` → amber manual-entry panel |
| Address (with or without unit) whose parcel is a large shared/HOA/commercial lot (>2.0 ac) | OK | acreage > 2.0 | "plans" screen, but **Recurring Service and Annual Plan tiles show no price** — only "One-Time $175" |

The third row is the more important one: it's not gated by whether the
address *looks* like a condo. **Any** address — house, condo, commercial
parcel — whose underlying GIS polygon exceeds 2.0 acres hits the same broken
"empty tile" rendering, confirmed for two non-condo civic-center addresses (D1,
D2) in
[QUOTE_REPRODUCTION_REPORT.md](./QUOTE_REPRODUCTION_REPORT.md).

## What *should* happen for each category?

| Category | Recommended treatment |
|---|---|
| **Condo/apartment, unit's own footprint ≤ 2 ac (rare but possible for some duplex/triplex parcels)** | Normal automatic quote — no special handling needed. |
| **Condo/apartment/townhome where the resolved parcel is the shared building/HOA/common-area lot (> 2 ac)** | The 21+ acre figure is *correct GIS data* but **meaningless for pricing a single unit**. Should NOT silently render as "21.057 acres" with broken pricing tiles. Should prompt the customer for their *unit's* approximate lot size, with sensible small-lot presets (0.05 / 0.10 / 0.25 ac — matches typical condo exclusive-use yard sizes), then price normally from that manual value. |
| **Large legitimate single property (>2 ac house lot, commercial property, etc.)** | Same UI treatment as above is appropriate — automated per-visit subscription/annual tiers don't make sense above 2 ac regardless of *why* it's large; this is genuinely outside the self-serve pricing table and needs either a manual estimate or a custom quote. (`AddressCheckerSection.tsx` already encodes exactly this idea via its existing `status: "custom"` branch for `fetchedAcreage > 2` — see below.) |
| **Geocoding fails entirely, even after unit-stripping** | Existing fallback: generic "we couldn't auto-detect this property" + manual entry. Unchanged. |

## Existing precedent in the codebase

`client/components/sections/AddressCheckerSection.tsx:108-113` **already**
implements the ">2 acres → custom" rule for its own (separate) "check your
address" flow:

```ts
const fetchedAcreage = data.acreage;
const tier = findTierByAcreage(fetchedAcreage);
if (!tier || tier.subscription === "custom" || fetchedAcreage > 2) {
  setResult({ status: "custom", acreage: fetchedAcreage });
} else {
  setResult({ status: "in_area", acreage: fetchedAcreage, tierLabel: tier.label });
}
```

**`QuoteWidgetSection.tsx` has no equivalent check** — it's the one place in
the customer-facing flow that renders pricing tiles directly from `acreage`
without first checking whether `acreage` falls within the priced range. This
is the actual gap.

## Recommended rule (implemented in this sprint)

A single, acreage-driven rule, independent of whether the address "looks like"
a condo (matches existing `AddressCheckerSection.tsx` precedent, and also
covers the non-condo D1/D2 cases):

> **If a successful parcel lookup returns `acreage > 2.0` (i.e., no pricing
> tier covers it — `buildPricingQuote(acreage).programs.subscription.cadenceOptions.length === 0`),
> do not render the normal "plans" screen.** Instead, show a panel explaining
> that this address matched a large/shared property record and ask the
> customer to enter their unit's/property's approximate lot size (with
> 0.05 / 0.10 / 0.25 ac presets), then price normally from that value.

Combined with the geocoding fix (strip unit suffixes — see
[QUOTE_FIX_IMPLEMENTATION_REPORT.md](./QUOTE_FIX_IMPLEMENTATION_REPORT.md)),
this means:

- `Unit 31`/`#31`/`Apt 31` variants of this address now **geocode
  successfully** (resolving to the same 21.057-acre shared parcel as the
  no-unit address) and reach this new ">2 ac" panel — with copy that
  correctly identifies it as a shared-property situation — instead of the
  generic "couldn't auto-detect" message.
- D1/D2-style large parcels also get this panel instead of broken pricing
  tiles, fixing the issue for properties that have nothing to do with condos.
- Properties ≤ 2 ac (the overwhelming majority of residential customers)
  continue straight to the normal "plans" screen, unchanged.

This avoids both failure modes named in the mission brief: it does not block
good customers unnecessarily (unit-suffixed addresses now resolve), and it
never quotes a 21-acre HOA parcel as a normal subscription/annual price.
