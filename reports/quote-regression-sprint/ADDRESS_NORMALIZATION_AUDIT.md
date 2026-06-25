# Address Normalization Audit

**Date:** 2026-06-11/12

---

## Where the address string is captured

`client/components/sections/QuoteWidgetSection.tsx:113`:

```ts
const [address, setAddress] = useState("");
```

A single freeform `<input>` (`placeholder="e.g. 123 Oak Street"`,
`autoComplete="street-address"`, `QuoteWidgetSection.tsx:227-234`). Whatever
the user types — including `Unit 31`, `#31`, `Apt 5`, etc. — is the entire
`address` string. The same pattern exists in `AddPropertyDialog.tsx` and
`AddressCheckerSection.tsx` (both also single freeform street-address inputs).

## Where city/state/zip are separated

Separate fields/state: `city`, `stateVal` (default `"CA"`), `zip`
(`QuoteWidgetSection.tsx:114-116`, inputs at lines 238-271). These are sent as
distinct fields in the POST body
(`{ address, zip, city, state: stateVal }` — `use-property-lookup.ts:54`).

## Is unit/apartment detected anywhere?

**No — nowhere in the codebase, frontend or backend, before this sprint's
fix.** Confirmed by:

- `client/components/sections/QuoteWidgetSection.tsx` — no regex/parsing of
  `address`, sent verbatim.
- `client/hooks/use-property-lookup.ts` — passthrough only.
- `server/routes/parcelQuote.ts:36-44` — only `.trim()` on `address`, and
  `zip.trim().replace(/\D/g, "").slice(0,5)` on `zip`. No address parsing.
- `server/services/parcel/parcelLookupService.ts` (pre-fix) — builds
  `normalizedForHash` by joining `address.trim(), city, state, zip` — no
  stripping/splitting of the address itself.
- `server/services/parcel/googleAddressService.ts` (pre-fix) — passes
  `[address, city, state, zip].join(", ")` straight to the geocoder.

## Is there any address normalization at all?

Only trivial whitespace/format normalization:
- `address.trim()` (`parcelQuote.ts:37`)
- `zip.trim().replace(/\D/g, "").slice(0, 5)` — strips non-digits, caps at 5
  (`parcelQuote.ts:38`)
- `city?.trim()`, `state?.trim() ?? "CA"`

No casing, abbreviation expansion (`St`→`Street`), or suffix handling exists.

## Does the unit cause geocoder failure?

**Yes — confirmed directly** in
[QUOTE_REPRODUCTION_REPORT.md](./QUOTE_REPRODUCTION_REPORT.md). Sending
`"22216 Caminito Escobedo, Unit 31"` (or `#31` / `Apt 31` / `Unit 31` with no
comma) to Nominatim's `/search` endpoint returns zero results. Sending
`"22216 Caminito Escobedo"` (no unit) returns a valid result. This is a known
OSM Nominatim limitation — its address index generally lacks
unit/subpremise-level entries for US addresses, and a structured/free-form
query containing an unrecognized trailing token returns **zero** matches
rather than ignoring it.

## Does the UI have a separate unit field?

**No.** `QuoteWidgetSection.tsx`, `AddressCheckerSection.tsx`, and
`AddPropertyDialog.tsx` all have exactly one street-address input. There is no
"Apt/Unit/Suite" field anywhere in the customer-facing or admin property
forms.

## Do Google Places fields exist but go unused?

**Yes.** `client/hooks/use-property-lookup.ts`'s `lookup()` signature accepts
optional `lat`, `lng`, `placeId` (added in `d83cd9a`, presumably for a future
Google Places Autocomplete integration), and `server/routes/parcelQuote.ts`
and `parcelLookupService.ts` both accept and use these if present (skipping
the geocode step, and — if `propertyId` is also supplied — persisting
`lat`/`lng` to the `properties` table). **No caller ever populates them.**
`grep` across `client/` for `Autocomplete`, `google.maps`, and `Places` finds
only marketing copy strings in `client/lib/translations.ts` ("Connects to
Google Places or Mapbox for autocomplete...") — aspirational text, not
implemented code.

---

## Answer: Should unit/suite be a separate field from street address?

**Not as the primary fix, but it would help.** Two complementary points:

1. **For the immediate problem (geocoding failure), a separate field is not
   required.** The fix applied in this sprint
   ([QUOTE_FIX_IMPLEMENTATION_REPORT.md](./QUOTE_FIX_IMPLEMENTATION_REPORT.md))
   detects and strips a trailing unit/apt/suite/`#` token from the *single*
   address string server-side before geocoding — this works regardless of
   whether the user typed it inline or in a separate field, and requires no
   UI/schema change.

2. **A separate "Apt/Unit/Suite (optional)" field would still be a genuine UX
   improvement**, independent of geocoding: it lets the system (a) preserve
   the unit number cleanly for the customer record/technician notes without
   regex-stripping it from a combined string, and (b) makes the "this is a
   multi-unit property" signal explicit and reliable (rather than inferred via
   regex) for the oversized-shared-parcel business rule in
   [MULTI_UNIT_PROPERTY_RULES_REPORT.md](./MULTI_UNIT_PROPERTY_RULES_REPORT.md).

Given the "smallest correct fix" constraint, this sprint implements (1) only.
A dedicated unit field is recorded as a low-priority follow-up, not required
to restore working quote functionality.
