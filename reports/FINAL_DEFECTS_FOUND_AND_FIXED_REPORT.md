# FINAL DEFECTS FOUND AND FIXED REPORT

**Sprint: Final Scheduling Verification + End-to-End Production Simulation**
**Date:** 2026-05-28

---

## Summary

This sprint found **no critical or high-severity defects** in the audited code. All previously reported fixes are confirmed in place. The defects found are medium/low severity architectural limitations that are safe to defer for beta launch.

**Total defects found in this sprint: 4**
**Fixed: 0** (no code changes needed; all are documented limitations)
**Deferred: 4**

---

## Defect 1 — Blackout Date Scope Not Filtered in Recurring Generator

| Field | Detail |
|-------|--------|
| **Title** | `generateRecurring.ts` treats all blackout dates as global regardless of scope |
| **Severity** | Medium |
| **File:Line** | `server/services/appointments/generateRecurring.ts:263–279` |
| **Root Cause** | `findAvailableSlot()` queries `blackout_dates` and builds `blackoutSet` from only the `date` column. The `scope` (`"all"` vs. `"service_area"`) and `service_area_id` fields are not fetched. Service-area-specific blackouts block slot finding for all properties, not just the ones in that area. |
| **Impact** | If admin sets a blackout for only one service area (scope = "service_area"), the recurring generator will skip that date for ALL properties, even those in other service areas. Conservative behavior — no appointment is incorrectly booked on a blacked-out date; at worst, the generator is over-restrictive. |
| **Fix Applied** | DEFERRED |
| **Deferred Reason** | MVP runs with a single service area. The conservative behavior (over-block) is safe. Fixing requires passing the property's service_area_id into findAvailableSlot, adding a scope filter to the blackout query, and testing. Low urgency for single-area launch. |
| **Status** | DOCUMENTED |

---

## Defect 2 — Recurring Generator Uses Global Business Hours Only

| Field | Detail |
|-------|--------|
| **Title** | `generateRecurring.ts` uses global business hours; area-specific overrides are ignored |
| **Severity** | Medium |
| **File:Line** | `server/services/appointments/generateRecurring.ts:263–271` |
| **Root Cause** | `findAvailableSlot()` queries `business_hours WHERE service_area_id IS NULL` (global only). When a service area has different operational days or hours, these overrides are not respected during recurring generation. Initial booking (`availability.ts`) and reschedule (`customerAppointments.ts`) do apply area-specific hours correctly. |
| **Impact** | Properties in service areas with custom business hours may receive auto-generated appointments on days their service area does not operate. For a single-area MVP with only global hours configured, this has no impact. |
| **Fix Applied** | DEFERRED |
| **Deferred Reason** | Requires passing `service_area_id` from the subscription/property through to `findAvailableSlot`, then loading area-specific hours and applying the same area-overrides-global logic used in `availability.ts`. Scope: medium refactor, low urgency for single-area launch. |
| **Status** | DOCUMENTED |

---

## Defect 3 — Admin Appointments Page Queries Via Anon Key (Potential RLS Block)

| Field | Detail |
|-------|--------|
| **Title** | `client/pages/admin/Appointments.tsx` uses Supabase anon key for appointment reads |
| **Severity** | Medium |
| **File:Line** | `client/pages/admin/Appointments.tsx:359–415` |
| **Root Cause** | The admin appointments page calls `supabase.from("appointments").select(...)` directly from the browser using the anon key. If RLS policies on the `appointments` table restrict reads to the `user_id` owner (which is standard for customer-facing tables), an admin logged in as a regular user will see 0 appointments. |
| **Impact** | Admin will see an empty appointment table unless either (a) RLS policies explicitly allow admin role to read all rows, or (b) the admin has a bypass policy. This must be verified against the actual RLS configuration in Supabase. |
| **Fix Applied** | DEFERRED |
| **Deferred Reason** | The fix requires either (a) adding a Supabase RLS policy `FOR SELECT USING (auth.jwt() ->> 'role' = 'admin')`, or (b) moving admin appointment reads to a server route that uses `supabaseAdmin`. This is a Supabase configuration issue, not a code bug per se. Requires knowledge of current RLS state before deciding the right fix. |
| **Status** | DOCUMENTED — Must be verified before launch |

---

## Defect 4 — Supabase Profile Row Creation Not Visible in Code

| Field | Detail |
|-------|--------|
| **Title** | Profile row creation depends on a Supabase trigger not present in application code |
| **Severity** | Medium |
| **File:Line** | Not in application code — should be in Supabase DB trigger |
| **Root Cause** | The `profiles` table row for new users is expected to be created automatically via a Supabase `auth.users` INSERT trigger. This trigger is not in any of the application files. If the trigger is missing or misconfigured, new users will have no profile row, causing silent failures in billing, notification, and onboarding flows. |
| **Impact** | If profile trigger is not deployed: new user signup → no profile row → `getOrCreateStripeCustomer` fails (no stripe_customer_id to read) → billing broken. Card sync, onboarding status, and notification preference reads also fail. |
| **Fix Applied** | DEFERRED |
| **Deferred Reason** | This is a Supabase infrastructure concern. The application code correctly writes to `profiles` in all the right places (billing confirmation, webhook). The trigger for initial row creation must be confirmed as deployed in the Supabase project before launch. Recommend adding a migration file for this trigger if one doesn't exist. |
| **Status** | DOCUMENTED — Manual verification required before launch |

---

## No-Fix Confirmation

The following were investigated and confirmed to NOT be defects:
- Dynamic capacity in all 4 booking paths: CORRECT
- Annual plan skip condition: CORRECT
- Duplicate appointment prevention: CORRECT
- Blackout date enforcement in booking/reschedule: CORRECT
- Completion notification: CORRECT
- No-slot alert ticket: CORRECT
- Card detail sync: CORRECT
- Employee assignment route: CORRECT
- Property coordinate persistence: CORRECT
- Stripe production key guard: CORRECT
- Test endpoint production block: CORRECT
