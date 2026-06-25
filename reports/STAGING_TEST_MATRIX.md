# Staging Test Matrix
**Date:** 2026-06-03
**Environment:** Local dev (localhost:8080) + Stripe test mode

---

## D1 — Customer Subscription Flow

| # | Test Step | Method | Expected |
|---|-----------|--------|---------|
| 1 | Homepage quote widget | Navigate to `/` | Widget visible in hero/pricing section |
| 2 | Enter Orange County address | Type address in widget | Google Places autocomplete appears |
| 3 | Submit address | Click "Get My Quote" | Parcel lookup fires, acreage returned |
| 4 | Price displayed | Observe UI | Tier pricing shown based on acreage |
| 5 | Signup | Click CTA | Redirects to /login → Create account tab |
| 6 | Create account | Fill form + submit | Account created, redirects to /onboarding |
| 7 | Onboarding intro | At /onboarding | "Let's set up your mosquito protection" page |
| 8 | Begin setup | Click "Schedule My First Visit" | ScheduleFlow loads |
| 9 | Availability selection | Pick preferred days/windows | Selection persists |
| 10 | Date/window selection | Pick date and time window | Calendar shows available slots |
| 11 | Payment page | Reach Stripe PaymentElement | Element renders correctly |
| 12 | Payment succeeds | Use test card `4242 4242 4242 4242` | Payment accepted |
| 13 | Appointment created | Check admin `/admin/appointments` | Appointment appears |
| 14 | Subscription created | Check admin `/admin/customers` | Active subscription |
| 15 | Profile marked onboarded | Check Supabase profiles | `is_onboarded = true` |
| 16 | Dashboard unlocked | Navigate to `/dashboard` | Dashboard renders without redirect |

**Stripe test card:** `4242 4242 4242 4242` · Exp: any future · CVC: any

---

## D2 — One-Time Service Flow

| # | Test Step | Expected |
|---|-----------|---------|
| 1 | Select "One-time visit" | ScheduleFlow shows one-time pricing |
| 2 | Complete payment | Payment succeeds |
| 3 | No subscription | No recurring subscription in Stripe |
| 4 | Appointment created | Appointment in admin |
| 5 | Dashboard | Shows one-time service state |

---

## D3 — Annual Plan Flow

| # | Test Step | Expected |
|---|-----------|---------|
| 1 | Select annual plan from quote | Flow routes to /contact or custom quote |
| 2 | No ScheduleFlow checkout | Annual plan does not enter payment flow |
| 3 | Backend validation | `POST /api/billing/confirm-booking` returns structured error if attempted directly |

---

## D4 — Payment Failure Flow

| # | Test Card | Expected |
|---|-----------|---------|
| 1 | `4000 0000 0000 0002` (declined) | "Your card was declined" toast |
| 2 | `4000 0000 0000 9995` (insufficient funds) | Insufficient funds error |
| 3 | Duplicate submit | Stripe prevents double charge; UI shows loading state |
| 4 | 3DS: `4000 0025 0000 3155` | 3DS challenge appears; on confirm → succeeds |

---

## D5 — Parcel Lookup Flow

| # | Address | Expected |
|---|---------|---------|
| 1 | `123 Main St, Irvine, CA 92618` | OC adapter → acreage returned |
| 2 | `456 Oak Ave, Riverside, CA 92501` | Riverside adapter → acreage returned |
| 3 | `789 Palm Dr, San Diego, CA 92101` | SD adapter → acreage returned |
| 4 | Unsupported county (e.g., Fresno ZIP) | `MANUAL_REVIEW_REQUIRED` response |
| 5 | Same OC address (2nd request) | Cache hit → `acreageSource: "cache"` |
| 6 | `ENABLE_REGRID_FALLBACK=false` | No Regrid API call |
| 7 | `ENABLE_PARCEL_COUNTY_LOOKUP=false` | Manual review (cache hits still work) |
| 8 | Malformed address | `INVALID_ADDRESS` 400 response |

---

## D6 — Scheduling / Availability Flow

| # | Scenario | Expected |
|---|----------|---------|
| 1 | Business day (Mon–Fri) | Windows shown |
| 2 | Business closed day (Sunday, if configured) | No slots shown |
| 3 | Blackout date configured | Date unavailable in calendar |
| 4 | Max capacity reached in a window | Window hidden or disabled |

---

## D7 — Workforce / Routing Flow

| # | Step | Expected |
|---|------|---------|
| 1 | Admin creates technician schedule | `/admin/workforce/schedules` → save |
| 2 | Admin creates capacity profile | `/admin/workforce/capacity` → save |
| 3 | Generate day route | Route created for available tech |
| 4 | Company blackout date set | `POST /routes/day/generate` → 400 |
| 5 | All techs unavailable | Empty routes + admin alert |
| 6 | Capacity exceeded | Overflow in `unassigned_appointments` |
| 7 | Publish validation blocks | 400 with blockers + `requestId` |
| 8 | Force publish override | Succeeds + audit log entry |

---

## D8 — Reminder Automation Flow

| # | Test | Expected |
|---|------|---------|
| 1 | `REMINDER_DRY_RUN=true` | Logs "would send" — no actual email |
| 2 | Trigger `send-reminders` function | Batch runs, checkpoints logged |
| 3 | Appointment marked canceled | Skipped in batch |
| 4 | Profile with no email | Skipped in batch |
| 5 | `ENABLE_REMINDER_EMAILS=false` | All sends suppressed |
| 6 | Same appointment same day (dedup) | Second attempt skipped |

**Rule:** Never send real emails during staging. Keep `REMINDER_DRY_RUN=true`.

---

## D9 — Admin Operations Flow

| # | Test | Expected |
|---|------|---------|
| 1 | Admin login at `/admin/login` | Redirects to `/admin` |
| 2 | Admin debug page | `/admin/debug` shows system status + health cards |
| 3 | Health dashboard refresh | Live health cards update |
| 4 | Operations metrics | `/api/admin/metrics/operations` returns real counts |
| 5 | Customer lookup | `/admin/customers` shows customer list |
| 6 | Appointment management | `/admin/appointments` shows appointments |
| 7 | Workforce hub | `/admin/workforce` shows setup status |
| 8 | Website management | `/admin/website-manager` loads content |

---

## D10 — Mobile UX Smoke Test

| # | Test | Expected |
|---|------|---------|
| 1 | Onboarding at 390px width | Fully responsive; no overflow |
| 2 | PaymentElement on mobile | Card element renders correctly |
| 3 | ScheduleFlow step navigation | Forward/back buttons accessible |
| 4 | Dashboard quick actions | Buttons tap-friendly |
| 5 | Employee portal mobile | Assignment list + status buttons work |
