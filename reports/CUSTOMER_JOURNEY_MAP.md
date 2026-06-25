# Customer Journey Map
**Date:** 2026-06-03
**Basis:** Direct source code inspection

---

## Path A — Quote Widget → Subscription (Primary Flow)

```
Homepage (/)
  ↓
Quote Widget (HeroSection / QuoteWidgetSection)
  → Address input → Parcel lookup (GIS) → Acreage returned → Price displayed
  ↓
Login/Signup (/login → Create account)
  → devAuth or Supabase signUp
  → Profile created (is_onboarded=false)
  → Redirect to /onboarding
  ↓
Onboarding Intro (/onboarding)
  → "Let's set up your mosquito protection" page
  → Button: "Schedule My First Visit"
  ↓
ScheduleFlow (inline, fullPage=true)
  Step 1: property   → Select or add property (address, ZIP)
                       → Parcel lookup if new property
  Step 2: plan       → Choose subscription cadence (14/21/30/42 days)
                       (skipped if initialProgram from quote widget)
  Step 3: availability → Select preferred days of week + arrival windows
                          + flexibility tolerance
  Step 4: date-time  → Calendar picker (45-day window)
                       → Select arrival window (Morning/Afternoon)
  Step 5: questionnaire → Pets, kids, standing water, gate instructions, notes
  Step 6: summary    → Review plan + date + cost + add-ons cross-sell
  Step 7: payment    → Inline Stripe PaymentElement
                       → POST /api/billing/create-payment-intent
                       → Stripe.js confirmPayment
                       → POST /api/billing/confirm-booking
  ↓
Booking Confirmed
  → Appointment created
  → Subscription created (if recurring)
  → Profile marked is_onboarded=true
  → Appointment confirmation email sent
  → Subscription activated email sent (via Stripe webhook)
  → Redirect to /dashboard
  ↓
Customer Dashboard (/dashboard)
  → Appointments tab
  → Billing tab
  → Properties tab
  → Profile tab
```

---

## Path B — Direct Signup (No Prior Quote)

```
Homepage → "Get Started" / "Schedule Service" button
  ↓
Login page → Create account
  → Redirect to /onboarding
  ↓
ScheduleFlow (starts at "plan" step — no initialProgram)
  → Customer selects plan (subscription vs one-time)
  → Continues through same 7 steps as Path A
```

---

## Path C — One-Time Service

```
Same as Path A/B but program="one_time"
  → PaymentIntent created (not subscription)
  → Single appointment created
  → No recurring subscription row
  → Dashboard shows "One-time service" state
```

---

## Path D — Annual Plan

```
Same as Path A/B but program="annual"
  → ScheduleFlow handleBeginSetup exits early
  → Navigates to /contact for custom quote
  → NO ScheduleFlow checkout
  → NO Stripe subscription
  → Backend rejects annual checkout via billing route
```

---

## Missing / Gap Analysis

| Gap | Severity | Notes |
|-----|----------|-------|
| No explicit "skip for now" recovery after skip | LOW | Fixed: skip now invalidates profile cache + redirects |
| Annual plan flow goes to /contact — no scheduling | EXPECTED | By design — custom quote |
| No explicit "reschedule" flow from dashboard | MEDIUM | Reschedule button exists in dashboard; triggers customerAppointments PATCH |
| Property acreage required before payment — no fallback for 0-acreage | MEDIUM | create-payment-intent returns 400; customer sees error in UI |
| No cart/checkout for marketplace add-ons bundled with subscription | LOW | Cross-sell shown at summary; separate cart flow for add-ons |

---

## Abandonment Risk Points

1. **Parcel lookup failure** — if county GIS times out, user sees "manual review required" → can't get quote without calling support
2. **Zero acreage property** — if property was created without acreage, payment step fails with 400
3. **Onboarding skip → redirect loop** — FIXED in prior sprint (profile cache invalidation)
4. **Session expiry during checkout** — auth token expires, payment intent creation fails with 401
