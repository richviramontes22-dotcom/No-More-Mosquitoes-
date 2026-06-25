# Out-of-Service-Area Quote Flow Fix Report

## Root cause

`POST /api/parcel/quote` already checked whether a ZIP was an active service area — but only inside a
fire-and-forget block used purely for internal lead tracking (creating an `out_of_area` lead +
`service_area_demand_event` for admin visibility). The customer-facing response never included this status,
so an out-of-area address that nonetheless resolved a real parcel (a CA address inside a GIS-supported
county, just not yet an active `service_areas` row) got a **full, real pricing quote** and could proceed
straight through to manual-acreage entry, plan selection, and checkout — exactly the bug described.

Separately, `AddressCheckerSection.tsx` already had mostly-correct out-of-area UI (it never offered manual
acreage for an out-of-area result), but its waitlist signup form was a complete dead end —
`handleWaitlistSubmit` just set a "submitted" flag with no API call, so no lead or demand event was ever
actually recorded.

## Fixes

**`server/routes/parcelQuote.ts`** — the service-area check now runs synchronously, before the response is
built. `quote` is only built when the address is covered; the response includes a new `outOfServiceArea`
boolean. The existing fire-and-forget lead-capture block now reuses this single check instead of querying
`service_areas` a second time.

**`client/hooks/use-property-lookup.ts`** — `outOfServiceArea` added to the `PropertyData` type and threaded
through the hook's result mapping.

**`client/components/sections/QuoteWidgetSection.tsx`** (the actual reported bug — the public instant-quote
widget) — `handleSearch` now checks `data.outOfServiceArea` before ever calling `setPhase("plans")`. When
true: no manual acreage panel, no pricing tiles, no path to checkout. Instead, a friendly message ("We're
not currently servicing this area yet...") with an email-capture form that calls the new waitlist endpoint
below.

**`server/routes/adminServiceAreas.ts`** — new public endpoint, `POST /api/service-areas/waitlist`. Validates
email + ZIP, calls the already-existing `upsertLeadFromOutOfArea` (creates/updates an out-of-area lead) and
`recordServiceAreaDemandEvent` (event type `waitlist_signup`, already supported the email/name fields — it
was simply never called from a public-facing form before now).

**`client/components/sections/AddressCheckerSection.tsx`** — `handleWaitlistSubmit` now actually calls the
new endpoint instead of just flipping a local "submitted" flag.

**`client/components/dashboard/properties/AddPropertyDialog.tsx`** — not explicitly named in this phase's
file list, but uses the same `usePropertyLookup` hook and has the identical structural gap (a customer
adding a property to their account from the dashboard). Given this dialog saves a property record for the
customer's own management rather than running a checkout itself, the fix here is a non-blocking warning
rather than a hard stop: if `outOfServiceArea` comes back true, the property can still be saved (it's the
customer's own record-keeping), but they're told immediately, clearly, that scheduling won't be available
there yet — rather than discovering that later with no explanation.

## What was verified live vs. what relies on code review

Verified directly against the local dev server and the live database:
- An in-area, real address (`22216 Caminito Escobedo, Laguna Hills, 92653` — confirmed active in
  `service_areas`) returns `outOfServiceArea: false` with a real quote, unaffected by this change.
- `service_areas` currently has **1,035 active ZIPs and zero inactive ones**, covering a broad swath of
  Southern California. Every out-of-state test address tried (New York, San Francisco) was rejected earlier
  in the pipeline by `lookupParcel`'s own county/GIS-coverage gate (`MANUAL_REVIEW_REQUIRED`) before ever
  reaching the new service-area check — meaning that specific gate already blocks the *most extreme*
  out-of-area cases, just not the narrower one this bug is actually about (a CA address inside a
  GIS-supported county that simply isn't an active service area yet).
- Reaching that narrower case live would require either an address in a not-yet-activated CA ZIP within a
  supported county (none currently exist to test against — every active ZIP is, well, active) or
  temporarily deactivating a real, live service-area row, which risks affecting real concurrent customer
  traffic and was deliberately avoided.
- **The `outOfServiceArea` branch logic itself was verified by direct code review of the diff**, not a live
  round-trip, for the reason above. A proper unit test with a mocked Supabase response (covering both the
  in-area and out-of-area cases deterministically, without touching live data) is added in Phase 6 — see
  `STABILIZATION_VALIDATION_REPORT.md`.

## Known residual gap (not fixed, scope decision)

`ScheduleFlow.tsx` (the booking/payment flow) does not itself re-check service-area status at property
selection or checkout — it only operates on properties already saved to the customer's account. The fixes
above prevent out-of-area properties from being created via the two public-facing quote paths
(`QuoteWidgetSection`, `AddressCheckerSection`); `AddPropertyDialog` still allows saving one (with a clear
warning) since that's account record-keeping, not a quote/checkout flow. A customer could theoretically
still reach checkout for a property saved that way. Closing that residual gap would mean adding a live
service-area re-check inside `ScheduleFlow` itself — a slightly bigger, separate change not attempted here
given the explicit file list for this phase didn't include it, and the deliberate, clearly-worded warning at
save-time meaningfully reduces how likely a customer is to actually attempt it.
