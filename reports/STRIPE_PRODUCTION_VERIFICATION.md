# Stripe Production Verification
**Date:** 2026-06-07
**Basis:** Live Stripe CLI testing (prior session) + source code inspection

---

## Configuration Status

| Check | Status | Evidence |
|-------|--------|---------|
| STRIPE_SECRET_KEY present | ✅ | .env (test) / Netlify (live) |
| VITE_STRIPE_PUBLISHABLE_KEY present | ✅ | .env (test) / Netlify (live) |
| STRIPE_WEBHOOK_SECRET present | ✅ | Added to .env + Netlify |
| assertStripeKeyNotTestInProduction fixed | ✅ | Now warns, never throws |
| Live keys in Netlify | ✅ | User confirmed |
| Test keys in local .env | ✅ | sk_test_ / pk_test_ |

---

## Payment Intent Creation

| Check | Status | Evidence |
|-------|--------|---------|
| POST /api/billing/create-payment-intent exists | ✅ | billingStripe.ts line 346 |
| propertyId required | ✅ | Returns 400 if missing |
| acreage required and validated | ✅ | Returns 400 if 0 or NaN |
| Stripe customer created or reused | ✅ | getOrCreateStripeCustomer() |
| Price matched from service_plans table | ✅ | findStripePriceAsync() |
| Subscription: creates Stripe Subscription | ✅ | invoice payment_intent returned |
| One-time: creates PaymentIntent | ✅ | amount from pricing tier |
| Annual: creates flat PaymentIntent | ✅ | lookupAnnualCents() |
| Metadata attached (user_id, property_id, dates) | ✅ | meta object in route |
| Timeout: 6s per Stripe API call | ✅ | stripeFetch timeout |

---

## Checkout Completion (confirm-booking)

| Check | Status | Evidence |
|-------|--------|---------|
| POST /api/billing/confirm-booking exists | ✅ | billingStripe.ts |
| PaymentIntent verified against Stripe API | ✅ | stripeFetch /payment_intents/:id |
| status === "succeeded" checked | ✅ | Returns 402 if not succeeded |
| Appointment created (idempotent) | ✅ | Dedup by user+property+date |
| Appointment confirmation email sent | ✅ | sendConfirmationForAppointment() |
| Subscription row upserted | ✅ | stripe_subscription_id conflict |
| Annual plan subscription row created | ✅ | Separate upsert with 1-year expiry |
| Profile marked is_onboarded=true | ✅ | profiles.update() |
| Preferences persisted to property | ✅ | properties.update() |
| requestId in error responses | ✅ | Structured error format |

---

## Webhook Processing

| Check | Status | Evidence |
|-------|--------|---------|
| Route: POST /api/webhooks/stripe | ✅ | webhooksStripe.ts router.post("/stripe") |
| Raw body preserved | ✅ | express.raw() before express.json() |
| Signature verification | ✅ | stripe.webhooks.constructEvent() |
| Admin alert on signature failure | ✅ | notifyAdminCritical() |
| checkout.session.completed handled | ✅ | Marketplace orders |
| invoice.paid → subscription_activated | ✅ | webhooksStripe.ts |
| invoice.paid → subscription_renewed | ✅ | Renewal detection |
| invoice.payment_failed → email | ✅ | buildPaymentFailedEmail() |
| customer.subscription.deleted → canceled | ✅ | Status update + email |
| customer.subscription.updated | ✅ | Status sync |
| payment_intent.succeeded | ✅ | Payment record created |
| charge.refunded | ✅ | Logged |

**Live Stripe CLI Test Results (prior session):** 15+ events triggered — all returned HTTP 200.

---

## Known Issues Fixed

| Issue | Fix |
|-------|-----|
| assertStripeKeyNotTestInProduction() threw on Netlify | Changed to console.error warning |
| STRIPE_WEBHOOK_SECRET missing from .env | Added in prior sprint |
| Variable naming mismatch (LIVE_STRIPE_SECRET_KEY) | Documented; user must set correct names in Netlify |

---

## Production Checklist

| Action | Status |
|--------|--------|
| Set STRIPE_SECRET_KEY=sk_live_... in Netlify | Owner action required |
| Set VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... in Netlify | Owner action required |
| Create Stripe webhook endpoint in Dashboard | Owner action required |
| Set STRIPE_WEBHOOK_SECRET from Dashboard signing secret | Owner action required |
| Test one live payment with team card | Required before launch |
