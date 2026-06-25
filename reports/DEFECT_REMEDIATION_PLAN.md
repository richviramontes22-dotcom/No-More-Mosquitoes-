# DEFECT REMEDIATION PLAN
## No More Mosquitoes — Prioritized Defect List
## Date: 2026-05-28
## Based on: System Validation, Lifecycle, Scheduling, and Payment audits

---

## Severity Definitions

| Severity | Meaning |
|----------|---------|
| Critical | Blocks core functionality or exposes data/security issue |
| High | Breaks a primary workflow for real users |
| Medium | Degrades experience but workaround exists |
| Low | Cosmetic, minor, or edge case |

---

## CRITICAL Defects

---

### CRIT-1: Annual Plan Customers Receive Zero Recurring Appointments After First Visit

**Severity:** Critical

**Root Cause:** `server/services/appointments/generateRecurring.ts` line 89:
```typescript
if (program === "one_time" || program === "annual") {
  result.skipped++;
  continue;
}
```
The skip condition explicitly excludes `program === "annual"`. Annual plan customers have `cadence_days` set (e.g., 21 for biweekly treatments) and a `subscriptions` row with `status = "active"`, but the recurring generator ignores them entirely.

**Impact:** Any customer who purchases an annual plan receives exactly one appointment (the one created at checkout). All subsequent treatment visits for the year must be manually scheduled by admin. If admin doesn't notice, customers receive no service after their first visit but have already paid for the year.

**Recommended Fix:**
```typescript
// Remove "annual" from the skip condition:
if (program === "one_time") { result.skipped++; continue; }

// Add expiry check for annual subscriptions:
if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
  result.skipped++; // Annual period ended — do not generate
  continue;
}
```

**Implementation Difficulty:** S (small — 3-line change + test)

---

### CRIT-2: Stripe Mode Mismatch Not Blocked — Can Silently Process Wrong-Mode Payments

**Severity:** Critical

**Root Cause:** `server/routes/billingStripe.ts` `getSecret()` function (lines 96–103): mode mismatch is logged as a warning but the key is returned and the request proceeds. If `NODE_ENV=production` but `STRIPE_SECRET_KEY` is a test key (or vice versa), Stripe API calls will either fail silently or process in the wrong mode.

**Impact:** A misconfigured production environment with a test key would allow "payments" to appear to succeed (test mode) while no real money changes hands. Alternatively, a live key in development could accidentally charge real customers.

**Recommended Fix:**
```typescript
if (isProd && isTestKey) {
  throw Object.assign(
    new Error("FATAL: Production environment requires a live Stripe key (sk_live_...). Current key is a test key."),
    { status: 500 }
  );
}
```

**Implementation Difficulty:** S (small — add throw, remove warn)

---

### CRIT-3: `profiles.card_last4` Never Populated — Payment Method Always Shows "No Payment Method on File"

**Severity:** Critical (High UX impact bordering on data integrity failure)

**Root Cause:** `client/pages/dashboard/Billing.tsx` reads `profile.card_last4` to display the customer's card. However, no server-side code ever writes `card_last4`, `card_brand`, or `card_expiry` to the `profiles` table. Not in webhooks, not in `confirm-booking`, not in `attach-payment-method`. The `useProfile` hook (`client/hooks/useProfile.ts`) selects these columns but they will always be `null`.

**Impact:** Every paying customer sees "No payment method on file" in their billing page even immediately after completing checkout. This creates immediate distrust and confusion. Customers may attempt to add their card again thinking there was an error.

**Recommended Fix:**
In the `invoice.paid` webhook (after a real successful charge), fetch the payment method from Stripe and write to profiles:
```typescript
// In webhooksStripe.ts invoice.paid handler, after upsert:
if (resolvedUserId && invoice.payment_intent) {
  try {
    const piDetails = await stripeFetch(`/payment_intents/${invoice.payment_intent}?expand[]=payment_method`);
    const pm = piDetails.payment_method;
    if (pm?.card) {
      await db.from("profiles").update({
        card_last4:  pm.card.last4,
        card_brand:  pm.card.brand,
        card_expiry: `${pm.card.exp_month.toString().padStart(2,'0')}/${pm.card.exp_year.toString().slice(-2)}`,
      }).eq("id", resolvedUserId);
    }
  } catch (e) { /* non-fatal */ }
}
```

**Implementation Difficulty:** M (medium — requires Stripe API call in webhook + new DB writes)

---

## HIGH Defects

---

### HIGH-1: Reschedule Capacity Check Uses Hardcoded 1-Technician Capacity

**Severity:** High

**Root Cause:** `server/routes/customerAppointments.ts` line 73:
```typescript
const capacity = 1 * (windowDef.max_jobs_per_tech ?? 3);
```
This hardcodes a single technician instead of querying `employees WHERE status = 'active'`. As the company adds technicians, rescheduled appointments will show falsely limited availability (only 3 slots per window instead of 3 × techCount).

**Impact:** Customers trying to reschedule see fewer available slots than actually exist. Slots appear "full" when they are not.

**Recommended Fix:**
```typescript
const { data: activeTechs } = await db.from("employees").select("id").eq("status", "active");
const activeTechCount = activeTechs && activeTechs.length > 0 ? activeTechs.length : 1;
const capacity = activeTechCount * (windowDef.max_jobs_per_tech ?? 3);
```

**Implementation Difficulty:** S (2-line change, mirrors existing `schedule.ts` and `availability.ts` fix)

---

### HIGH-2: Annual Plan Year-2 Renewal Has No Trigger

**Severity:** High

**Root Cause:** `subscriptions.current_period_end` is set to `now + 365 days` for annual plans, but no cron job, webhook, or notification fires when this date approaches. Year 2 renewal is entirely manual.

**Impact:** Annual customers silently lose service after 12 months. No automated outreach. Admin must manually query for expiring plans and contact each customer.

**Recommended Fix:**
Add a Netlify scheduled function that runs monthly:
```typescript
// netlify/functions/annual-renewal-alerts.ts
const { data: expiring } = await db.from("subscriptions")
  .select("id, user_id, property_id, current_period_end")
  .eq("program", "annual")
  .eq("status", "active")
  .gte("current_period_end", addDays(today, 25))
  .lte("current_period_end", addDays(today, 35));
// Send renewal email to each customer and create admin alert
```

**Implementation Difficulty:** M (new Netlify function + email template)

---

### HIGH-3: No Employee Notification When Assigned to a Job

**Severity:** High

**Root Cause:** Assignment creation is a direct Supabase `upsert` from the admin frontend. No server route is called, so no side effects (notifications, emails, SMS) can fire. Employees must poll the portal to discover new assignments.

**Impact:** An employee could miss a job they were assigned to if they don't habitually check the portal. For time-sensitive dispatches (same-day assignments), this is operationally risky.

**Recommended Fix:**
Route the assignment creation through a server endpoint:
```
POST /api/admin/assignments
Body: { appointment_ids: [], employee_id: "" }
→ Upsert assignments
→ Send email/SMS to employee: "New job assigned for [date]"
```

**Implementation Difficulty:** M (new server route + email template)

---

### HIGH-4: Test Payment Method Endpoint Accessible in Production

**Severity:** High (security)

**Root Cause:** `server/routes/billingStripe.ts` line 1012: `router.post("/create-and-attach-payment-method", ...)` — this endpoint accepts Stripe test tokens (`tok_visa`, `tok_mastercard`) and processes them against a live Stripe customer if a live key is configured. No NODE_ENV guard.

**Impact:** An attacker could POST to this endpoint in production with a test token. In test mode it creates a test source on the live customer. It would not result in fraudulent charges but could corrupt customer data.

**Recommended Fix:**
```typescript
router.post("/create-and-attach-payment-method", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not available" });
  }
  // ... existing code
});
```

**Implementation Difficulty:** XS (1-line guard)

---

### HIGH-5: `findAvailableSlot()` in Recurring Generation Ignores Service-Area-Specific Business Hours

**Severity:** High

**Root Cause:** `server/services/appointments/generateRecurring.ts` `findAvailableSlot()` function fetches only global business hours:
```typescript
.from("business_hours").select("...").is("service_area_id", null)
```
Service-area-specific business hour overrides (which would restrict or expand available days for specific areas) are completely ignored for auto-generated appointments.

**Impact:** If certain service areas have different operating days (e.g., no Saturday service in a particular area), auto-generated appointments may be created on invalid days for those areas.

**Recommended Fix:** Join the property's `service_area_id` and pass it to `findAvailableSlot()`, then load both global and area-specific hours (mirroring the `availability.ts` pattern).

**Implementation Difficulty:** M (requires joining service_area_id through subscription → property)

---

## MEDIUM Defects

---

### MED-1: Pre-Service Checklist Not Persisted in Employee App

**Severity:** Medium

**Root Cause:** `client/pages/employee/AssignmentDetail.tsx` renders pre-service checklist items (PPE, pets, chemicals, etc.) as static HTML checkboxes with no state binding to any backend. The checklist is purely decorative — checking boxes does nothing.

**Impact:** No compliance documentation for pre-service safety checks. If a safety incident occurs, there is no record that the checklist was completed. Employees may ignore the checklist knowing it has no consequence.

**Recommended Fix:**
Add a `checklist_completed_at TIMESTAMPTZ` and `checklist_data JSONB` to `assignments`. Save checklist state to server when employee taps "Begin Service."

**Implementation Difficulty:** M

---

### MED-2: No Customer Notification When Job Is Completed

**Severity:** Medium

**Root Cause:** When `employeeAssignments.ts` cascades the completion to `appointments.status = "completed"`, no notification is sent to the customer. The completion cascade (lines 211–223) only writes DB records.

**Impact:** Customers don't know their service has been performed until they check the dashboard. In a mobile-first world, customers expect a push/email when their service is done.

**Recommended Fix:**
In `employeeAssignments.ts` after successful cascade:
```typescript
if (status === "completed" && updated.appointment_id) {
  // ... existing cascade ...
  await sendJobCompletionNotification({ appointmentId: updated.appointment_id, userId: ... });
}
```

**Implementation Difficulty:** M (new email template + fire-and-forget call)

---

### MED-3: No Admin Alert When Recurring Generation Cannot Find a Slot

**Severity:** Medium

**Root Cause:** `generateRecurring.ts` increments `result.noSlotFound` when no available slot is found for a subscription, and logs an error message, but this information only appears in Netlify function logs. No admin-visible alert exists.

**Impact:** Subscriptions that need manual scheduling silently accumulate. Admin only discovers the problem by reading Netlify logs.

**Recommended Fix:**
After `runRecurringGeneration()` completes, if `result.noSlotFound > 0`, create a support ticket or admin notification:
```typescript
if (result.noSlotFound > 0) {
  await db.from("tickets").insert({
    subject: `[System] ${result.noSlotFound} subscription(s) need manual scheduling`,
    body: result.errors.join("\n"),
    priority: "high",
    status: "new",
  });
}
```

**Implementation Difficulty:** S

---

### MED-4: Property GPS Coordinates Not Automatically Populated at Booking

**Severity:** Medium

**Root Cause:** `db/migrations/2026-05-28_property_coordinates.sql` adds `lat`/`lng` columns, but no code writes to these columns during booking. The backfill documented in migration comments requires a manual SQL query.

**Impact:** GPS map and navigation link in `AssignmentDetail.tsx` remain disabled for all properties until a manual geocoding backfill is run. Technicians cannot get turn-by-turn navigation from the app.

**Recommended Fix:**
In `confirm-booking` or the parcel lookup service, if geocoding resolves coordinates, write them to the property:
```typescript
if (geocodedLat && geocodedLng) {
  await supabaseAdmin.from("properties").update({ lat: geocodedLat, lng: geocodedLng }).eq("id", propertyId);
}
```

**Implementation Difficulty:** M (requires passing coordinates through from parcel service)

---

### MED-5: Promo `increment_promo_used_count` RPC May Not Be Deployed

**Severity:** Medium

**Root Cause:** `webhooksStripe.ts` line 661 calls `supabase.rpc("increment_promo_used_count", { promo_id })`. If the RPC is not deployed in Supabase, the call fails and a non-atomic read-then-write fallback is used. Under concurrent payments, two promo uses could be recorded simultaneously without the `used_count` reflecting both.

**Impact:** Promo codes may exceed their `max_uses` limit under concurrent checkout pressure. For high-volume promotions, this is a real risk.

**Recommended Fix:**
Deploy the `increment_promo_used_count` Supabase function and confirm it exists before launch. The fallback remains as a safety net.

**Implementation Difficulty:** S (SQL RPC function deployment)

---

### MED-6: `deleteAccount` Soft-Delete Has No Customer Feedback Beyond Toast

**Severity:** Medium

**Root Cause:** `client/pages/dashboard/Profile.tsx` `handleDeleteRequest()` inserts a ticket and shows a toast: "We'll process your request within 3–5 business days." However, the customer's account remains fully active with no visible indication of pending deletion. There is no email confirmation sent.

**Impact:** Customers who request deletion may try again thinking the first request didn't work, creating duplicate tickets. No email acknowledgment creates uncertainty.

**Recommended Fix:**
Send a confirmation email to the customer after successful ticket creation. Optionally add a "Deletion Requested — Pending" badge to the Profile page.

**Implementation Difficulty:** S

---

## LOW Defects

---

### LOW-1: Blog Page Shows "Coming Soon" — CMS Has Content Management but No Posts Published

**Severity:** Low

**Root Cause:** `client/pages/Blog.tsx` renders a "Posts coming soon" message. The WebsiteManager admin page has a blog post CMS. No posts have been published through it.

**Impact:** Blog page is empty. SEO value of blog is lost.

**Recommended Fix:** Admin publishes at least one post through `/admin/website-manager`. No code changes needed.

**Implementation Difficulty:** XS (content entry, not code)

---

### LOW-2: `Videos.tsx` Page Is Unreachable

**Severity:** Low

**Root Cause:** `client/App.tsx` has a route `/dashboard/videos` that redirects to `/dashboard/appointments`. The `Videos.tsx` component exists and is functional but is not accessible via any route.

**Impact:** The dedicated videos page is inaccessible. Videos are shown inside the Appointments page's "Visit Recaps" tab, which may be less discoverable.

**Recommended Fix:** Either remove the redirect and reinstate `/dashboard/videos` as a real route, or remove the `Videos.tsx` component entirely if the Appointments tab is the preferred location.

**Implementation Difficulty:** XS

---

### LOW-3: Admin Overview Ticket Count Label Ambiguity

**Severity:** Low

**Root Cause:** Admin overview KPI "Open Tickets" counts all tickets not in a resolved state. The label doesn't distinguish between customer support tickets and account deletion requests (which are also in the `tickets` table since Sprint 3C).

**Impact:** Admins may see inflated "Open Tickets" counts that include deletion requests, confusing support load metrics.

**Recommended Fix:** Filter the overview count to exclude `tickets WHERE subject LIKE '%Deletion%'` or add a `type` filter to distinguish support tickets from system-generated tickets.

**Implementation Difficulty:** XS

---

### LOW-4: Annual Pricing Tiers Hardcoded in Two Places

**Severity:** Low

**Root Cause:** Annual plan pricing is defined in:
1. `server/routes/billingStripe.ts` — `ANNUAL_TIERS_SERVER` array (lines 10–23)
2. `client/components/schedule/ScheduleFlow.tsx` — `ANNUAL_TIERS` client-side array

These must be kept manually in sync. A price change requires editing both files.

**Impact:** Price mismatch between client display and server charge if one file is updated without the other.

**Recommended Fix:** Move annual pricing tiers to the `service_plans` table or a shared config. Fetch from a single source of truth.

**Implementation Difficulty:** M

---

### LOW-5: `assigned_at` Timestamp Not Recorded on Assignments

**Severity:** Low

**Root Cause:** The `assignments` table tracks `en_route_at`, `arrived_at`, `started_at`, `completed_at` but not `assigned_at` (when the admin created the assignment). Direct Supabase upsert from admin frontend doesn't pass a custom timestamp.

**Impact:** Cannot report on the gap between appointment creation and assignment. Cannot track how quickly admins respond to new appointments.

**Recommended Fix:** Add `assigned_at TIMESTAMPTZ DEFAULT now()` to the `assignments` table schema. The upsert will populate it automatically.

**Implementation Difficulty:** XS (migration only)

---

## Defect Count Summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 5 |
| Medium | 6 |
| Low | 5 |
| **Total** | **19** |
