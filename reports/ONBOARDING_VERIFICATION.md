# Onboarding Verification
**Date:** 2026-06-03

---

## Account Creation

| Check | Status | Evidence |
|-------|--------|---------|
| Supabase signUp called with email + password | ✅ | AuthContext.tsx signUp() |
| Profile trigger creates profile row | ✅ | ensure_profile_trigger migration |
| Profile upsert uses correct role='customer' | ✅ | devAuth.ts fixed (upsert not insert) |
| @test.com emails skip confirmation via devAuth | ✅ | devAuth.ts |
| Employee redirect fixed for role='employee' | ✅ | Login.tsx + postLoginRoleCheck.ts |
| is_onboarded defaults false | ✅ | Migration confirmed |

---

## Login & Redirect

| Check | Status | Evidence |
|-------|--------|---------|
| Customer → /dashboard (if onboarded + active subscription) | ✅ | postLoginRoleCheck.ts |
| Customer → /onboarding (if not onboarded) | ✅ | Login.tsx |
| Admin → /admin | ✅ | postLoginRoleCheck.ts |
| Employee → /employee | ✅ | Login.tsx (fixed today) |
| Skip for now → /dashboard (after cache invalidation) | ✅ | Onboarding.tsx (fixed prior sprint) |

---

## Property Creation

| Check | Status | Evidence |
|-------|--------|---------|
| Properties fetched from Supabase by user_id | ✅ | ScheduleFlow.tsx fetchProperties() |
| AddPropertyDialog: address + ZIP required | ✅ | AddPropertyDialog.tsx validation |
| Parcel lookup triggered on property add | ✅ | use-property-lookup.ts |
| Acreage persisted to properties table | ✅ | DB write in parcel route |
| Property coordinates persisted (lat/lng) | ✅ | parcelQuote.ts |
| Property selection auto-selects first if only one | ✅ | ScheduleFlow.tsx |

---

## Acreage Lookup

| Check | Status | Evidence |
|-------|--------|---------|
| County detection from ZIP | ✅ | countyDetector.ts |
| OC/Riverside/SD adapters | ✅ | Adapter files |
| Cache checked before GIS call | ✅ | parcelLookupService.ts |
| Manual review returned cleanly when unsupported | ✅ | MANUAL_REVIEW_REQUIRED response |
| Regrid disabled by default | ✅ | ENABLE_REGRID_FALLBACK=false |
| County lookup disabled flag respected | ✅ | Feature flag gate |
| requestId flows end-to-end | ✅ | Instrumentation sprint |

---

## Quote Generation

| Check | Status | Evidence |
|-------|--------|---------|
| Pricing tiers defined | ✅ | pricingQuote.ts + billingStripe.ts |
| Acreage required for price lookup | ✅ | create-payment-intent validation |
| 0.01–2.0 acre range supported | ✅ | Annual tier table |
| Price displayed before payment | ✅ | ScheduleFlow summary step |
| Acreage from parcel cache on second lookup | ✅ | Cache hit path |

---

## Subscription Onboarding

| Check | Status | Evidence |
|-------|--------|---------|
| create-payment-intent creates Subscription (not PI) | ✅ | billingStripe.ts subscription path |
| clientSecret returned from latest invoice | ✅ | Stripe subscription.latestInvoice |
| confirm-booking called after Stripe confirmPayment | ✅ | ScheduleFlow handlePaymentConfirmed |
| Appointment created in confirm-booking | ✅ | billingStripe.ts |
| Appointment confirmation email sent | ✅ | Fixed in email sprint |
| Subscription row created in Supabase | ✅ | webhooksStripe.ts invoice.paid |
| Profile marked is_onboarded=true | ✅ | confirm-booking |
| Redirect to dashboard after booking | ✅ | ScheduleFlow |

---

## One-Time Service Onboarding

| Check | Status | Evidence |
|-------|--------|---------|
| create-payment-intent creates PaymentIntent | ✅ | billingStripe.ts one_time path |
| No subscription row created | ✅ | Confirmed: subscription only for recurring |
| Appointment created | ✅ | confirm-booking |
| Dashboard shows one-time state | ✅ | useSubscriptions returns empty |

---

## Potential Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| If property has no acreage (0), payment fails with unhelpful 400 | MEDIUM | Error message now improved; but user must re-look up acreage |
| Flow progress not cleared if user abandons mid-payment | LOW | `clearFlowProgress` called on success; stale progress on cancel doesn't break flow |
| Phone number field pre-fill may show wrong number if profile.phone differs | LOW | Phone marked from-profile; user can override |
