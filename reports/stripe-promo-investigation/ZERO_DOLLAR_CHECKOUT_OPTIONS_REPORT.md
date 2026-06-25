# Zero-Dollar Checkout — Business Rule Options

This is a decision document, not a recommendation to act now — see the final report for "should fixes be
implemented in a separate sprint."

## Option A — True $0 checkout, no Stripe payment at all

**Behavior**: when the discounted amount would be $0 (or below Stripe's $0.50 minimum), skip PaymentIntent
creation entirely. Create the booking/appointment directly, mark it as promo-covered in the database,
increment promo usage, and skip card collection.

**Pros**: matches customer expectation exactly for a 100%-off code — "free" actually means free, no card
charge of any kind. Simplest customer experience.
**Cons**: no card on file is captured/verified, which matters for **subscriptions and annual plans**
specifically (this app auto-renews/re-bills on a cadence — a "free" first visit with no card on file means
the *next* recurring charge has nothing to bill against, unless a card is collected through some other
step). For a true one-time service with no future billing, this concern doesn't apply.

## Option B — Stripe SetupIntent for card verification, no charge

**Behavior**: create a Stripe `SetupIntent` instead of a `PaymentIntent`. No money moves, but the card is
verified as real/chargeable and saved to the customer for future use.

**Pros**: more correct than a token charge — verifies the card without misleading the customer about being
charged. Directly useful for subscriptions/annual plans where a card needs to be on file for the *next*
billing cycle anyway.
**Cons**: slightly more implementation work than Option A (a second Stripe object type, separate confirmation
flow on the frontend). Doesn't create a "this visit was paid" record the same way a $0 PaymentIntent-skip
does — needs its own "promo-covered, card verified" booking state.

## Option C — Keep the minimum charge, but make it honest

**Behavior**: keep charging the $0.50 floor (or whatever Stripe's actual minimum is), but fix the display
bug so the UI says "$0.50" — not "$1" — and add explicit copy ("a minimum 50¢ card-verification charge
applies to fully-discounted bookings") so the customer isn't surprised by *any* charge on a "100% off" code.

**Pros**: smallest change — the display bug fix described in `FRONTEND_BACKEND_AMOUNT_MISMATCH_REPORT.md`
is most of this option's work already. No new Stripe object types.
**Cons**: still charges a customer something on a code explicitly marketed as "100% off," which is a real
customer-trust/expectation problem regardless of how clearly it's disclosed — "100% off" implies $0, and a
nonzero charge of any size contradicts that, however small.

## Option D — Disallow 100%-off live promo codes

**Behavior**: cap percent-off codes at 99% (or require a fixed-dollar discount strictly less than the order
total), enforced at promo-creation time in the admin Promos tool and re-validated server-side at checkout.

**Pros**: eliminates the $0/floor edge case entirely — there's always a real, meaningful remainder to
charge, so the minimum-charge floor logic never gets triggered by design.
**Cons**: removes a legitimate business tool — "first visit free" / fully comped service for a referral,
VIP, or service-recovery gesture is a normal, intentional use case businesses want, and this option takes
it away rather than handling it correctly.

## Recommendation by plan type

| Plan type | Recommended option | Why |
|---|---|---|
| **One-time service** | **Option A** | No future billing relationship — there's no reason to collect/verify a card if this visit is genuinely free. Simplest, most honest customer experience. |
| **Annual plan** | **Option B** | Annual plans still auto-renew at the end of the term — a card needs to be on file for that future renewal even if *this* payment is $0, making SetupIntent's card-verification-without-charging exactly the right tool. |
| **Subscription plan** | **Option B** | Same reasoning as annual, more so — subscriptions bill on every cadence cycle; a 100%-off *first* cycle still needs a verified card on file for cycle two. (Today's subscription flow already uses Stripe-native promotion codes, which Stripe itself may already handle a $0-first-invoice case more gracefully than the one_time/annual cents-math path — worth confirming Stripe's own behavior here specifically before building anything new.) |

Option C (fix the display, keep the charge) is the **smallest possible change** if a fast fix is wanted
before a fuller Option A/B implementation — but it should be treated as a stopgap, not the destination,
given the "100% off should mean $0" trust problem it doesn't actually solve.

Option D is not recommended for any plan type — it solves the technical problem by removing a legitimate
business capability rather than implementing it correctly.
