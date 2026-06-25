# Operations Regression Report

## Methodology note, carried forward from the prior sprint

Express's SPA catch-all returns `200` with `index.html` for *any* unmatched path — a guessed endpoint that
doesn't exist will falsely look "fine" if you only check the status code. Every check below verifies the
actual response body/content-type, not just the status. This caught one more false-positive this round
(below), in addition to the two from the prior sprint.

## Live regression spot-checks, this sprint

| System | Endpoint/check | Result |
|---|---|---|
| CRM / Leads | `GET /api/admin/leads` | `200`, valid JSON |
| Customer Service dashboard | `GET /api/admin/customer-service/dashboard` | `200`, valid JSON |
| Sales dashboard | `GET /api/admin/sales/dashboard` | `200`, valid JSON |
| Customer satisfaction | `GET /api/admin/satisfaction/dashboard` | `200`, valid JSON |
| Service areas | `GET /api/admin/service-areas` | `200`, valid JSON |
| Workforce optimization | `GET /api/admin/workforce-optimization` | `200`, valid JSON (re-confirms Phase 4) |
| Territory intelligence | `GET /api/admin/territory-intelligence` | `200`, valid JSON (re-confirms Phase 5) |
| Promo codes | `GET /api/admin/promos/codes` | `200`, valid JSON |
| Operations Command Center | `GET /api/admin/operations/summary` | `200`, valid JSON (the new endpoint itself) |
| Technician assignments query | Direct REST: `assignments` joined to `appointments` | Still works — confirms the embedded-resource ordering fix from the `production-stabilization` sprint is unaffected |
| Checkout (normal, in-area) | `POST /api/billing/create-payment-intent` for a real in-area property | Real Stripe PaymentIntent created — **confirms Phase 1's new service-area gate does not block normal checkout**, only out-of-area properties |

## False positive caught this round

`GET /api/admin/tickets` returned `200` but with the SPA's `index.html`, not JSON — **no such endpoint
exists**. Confirmed by reading `Tickets.tsx` directly: the admin Tickets page fetches via a direct Supabase
client query (`supabase.from("tickets").select(...)`), the same architecture as the customer-facing
ticket/message pages, not a REST endpoint. Not a regression — there was never an endpoint at that path to
regress. The actual ticket workflow (create, reply, escalate, resolve) was already verified live end-to-end
in the prior sprint and was not touched by anything in this sprint.

## What this sprint changed, and why each change is regression-safe

| Change | Why it's safe |
|---|---|
| `assertPropertyInServiceArea` gate added to `create-payment-intent` / `confirm-booking` | Only returns non-null (blocking) for properties with no active `service_areas` match — confirmed live above that a normal in-area property still proceeds to a real PaymentIntent exactly as before |
| New `adminOperations.ts` route + `/admin/operations` page | Purely additive — a new route mounted alongside existing ones, a new nav link added without modifying any existing nav entry's markup or behavior |
| `EMPLOYEE_ROLES`, `AdminLogin.tsx`, `Login.tsx` role-redirect widening (carried from prior sprint, re-confirmed unaffected here) | Only adds new role branches; existing `admin`/`support`/`customer` branches untouched |

## Conclusion

No regressions found. One pre-existing, unrelated non-issue (the `/api/admin/tickets` false positive) was
identified and correctly ruled out via direct code inspection rather than assumed from a status code.
