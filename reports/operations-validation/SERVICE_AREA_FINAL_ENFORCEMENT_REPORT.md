# Service Area Final Enforcement Report

## The gap

`AddPropertyDialog.tsx` (fixed in the prior sprint) allows a customer to save an out-of-area property to
their own account, with a clear warning that scheduling won't be available there. That warning was
**advisory only** — nothing on the server actually stopped the property from reaching checkout if the
customer tried anyway. `ScheduleFlow.tsx` has no service-area check of its own; it trusts whatever property
the customer selected.

## The fix — server-side, not client-side

Client-side checks can always be bypassed (direct API calls, browser devtools, a stale cached page). The
real gate has to be on the server, at the points that actually create a charge or an appointment. Added a
single helper, `assertPropertyInServiceArea(propertyId)`, in `server/routes/billingStripe.ts`, called at
both of this flow's two real enforcement points:

1. **`POST /api/billing/create-payment-intent`** — the primary gate. Runs immediately after the existing
   acreage validation, before any Stripe object is created. Looks up the property's `zip`, checks
   `service_areas` for an active match, and returns `403 { error, code: "OUT_OF_SERVICE_AREA" }` if not
   covered.
2. **`POST /api/billing/confirm-booking`** — defense in depth. In the normal flow this is unreachable for an
   out-of-area property (no PaymentIntent could have been created for it), but it guards against a
   PaymentIntent created before this fix existed, or any other path that reaches this endpoint directly.

## What "before plan selection / checkout / route creation / appointment creation" actually means here

- **Plan selection** happens entirely client-side before any server call — there's nothing to gate there;
  the property's coverage status was already established earlier (at the public quote-widget stage, fixed
  in the prior sprint) for properties created through the normal quote flow. The new gate here specifically
  closes the path where a property *skipped* that earlier check (saved via `AddPropertyDialog`).
- **Checkout** is gated directly — `create-payment-intent` is the very first server call the payment step
  makes, and it's now blocked before any Stripe object exists.
- **Route/appointment creation** — `confirm-booking` is what creates the appointment. Gated as defense in
  depth, per above. There's no other path in this app's current code that creates an appointment from a
  customer-initiated booking without going through one of these two endpoints first.

## Frontend: friendly message + waitlist, not a dead error box

`ScheduleFlow.tsx`'s payment-step fetch now checks the response for `code: "OUT_OF_SERVICE_AREA"` and shows
a dedicated panel — "We're not currently servicing this area yet," with an email-capture form — instead of
the generic payment-error box (whose only action, "Retry," would have just failed again identically). The
waitlist form reuses the same `/api/service-areas/waitlist` endpoint built in the prior sprint
(creates/updates an out-of-area lead + a `service_area_demand_events` row), so this is genuine demand
capture, not just a dead-end message.

## Verified live, not just by code review

| Test | Result |
|---|---|
| Real in-area property (Irvine, 92614, confirmed active in `service_areas`) through `create-payment-intent` | `200`, real Stripe PaymentIntent created — unaffected by this change |
| Real out-of-area property (created via direct insert, NYC 10001, confirmed **not** in `service_areas`) through `create-payment-intent` | `403 {"error":"We're not currently servicing this area yet.","code":"OUT_OF_SERVICE_AREA"}` — exactly as designed |

`pnpm typecheck`: clean. `pnpm test`: 181/181 passing, no regressions.

## What this does not change

- `AddPropertyDialog.tsx` still allows *saving* an out-of-area property for the customer's own
  record-keeping, with its existing warning. That's a deliberate, unchanged scope decision — this sprint
  closes the path from "property exists" to "service was actually booked," not the ability to record a
  property's address at all.
- No new database migration was needed — this reuses the existing `service_areas` table and the existing
  `properties.zip` column, the same data source the public quote-widget check (prior sprint) already relies
  on.
