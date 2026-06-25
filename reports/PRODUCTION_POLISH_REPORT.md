# Production Polish Report
**Sprint 3 — No More Mosquitoes**
**Date:** 2026-05-28

---

## Overview

Six polish items were addressed to bring the application from "feature-complete prototype" to "production-ready":

| Item | Description |
|------|-------------|
| 3A | Admin customer status was always showing `active` regardless of subscription state |
| 3B | Billing page showed fake Visa 4242 card when no real payment method existed |
| 3C | "Delete Account" button did nothing |
| 3D | SMS reminders sent to all users regardless of their opt-in preference |
| 3E | Several UI panels showed hardcoded dummy data |
| 3F | Route planning tables — verified already present, no action needed |

---

## Sprint 3A — Real Admin Customer Status

**File:** `client/pages/admin/Customers.tsx`

**Before:** Every customer showed `"active"` regardless of their actual subscription status.

**After:** Status is resolved by priority-ranking each user's subscriptions:
- `active (3) > past_due (2) > canceled (1)`
- Maps to UI values: `canceled → "canceled"`, `past_due → "paused"`, anything else → `"active"`

Also fixed `CustomerDetailsSheet` — it was fetching subscription status but hardcoding `"active"` in the display. Now uses the same priority resolution.

---

## Sprint 3B — Remove Fake Payment Method

**File:** `client/pages/dashboard/Billing.tsx`

**Before:** Card state defaulted to `"4242"` (last4), `"Visa"` (brand), `"12/2026"` (expiry). A hardcoded "Mastercard ending in 5555" was injected on payment method update success.

**After:**
- State type: `{ cardLast4: string | null; cardBrand: string | null; cardExpiry: string | null }`
- Defaults to `null`; populated only from real Stripe data
- Display: `"No payment method on file"` when null
- `handlePaymentMethodSuccess` no longer sets any hardcoded values

---

## Sprint 3C — Delete Account Flow

**File:** `client/pages/dashboard/Profile.tsx`

**Before:** "Delete Account" button had no handler — clicking did nothing.

**After:** Clicking opens a confirmation dialog. The user must re-enter their email address to confirm. On confirm:
1. Validates that the entered email matches `user.email`
2. Inserts a row into the `tickets` table with `subject: "Account deletion request"` and `type: "account_deletion"`
3. Shows success toast and closes dialog

This is a soft-delete / support-ticket flow — appropriate for a regulated service business where immediate hard-delete is not safe. An admin can action the ticket.

---

## Sprint 3D — SMS Reminder Preferences

**Files:** `server/services/notifications/reminderScheduler.ts`, `server/services/notifications/smsTemplates.ts`

**Before:** Reminder scheduler sent SMS to any user with a phone number, ignoring notification preferences.

**After:**
- Profiles query now selects `phone` and `notification_preferences`
- `profileMap` includes `smsReminders: boolean` (defaults to `true` if not explicitly set to `false`)
- SMS is only attempted when all three conditions are met:
  ```typescript
  if (profile.smsReminders && profile.phone && isSmsConfigured())
  ```
- SMS failure is non-fatal — email is already sent, SMS error appended to `result.errors` but does not increment `result.failed`

Added `buildReminderSms()` to `smsTemplates.ts` with proper `ReminderSmsData` interface.

---

## Sprint 3E — Remove Placeholder Data

### Admin Overview (`client/pages/admin/Overview.tsx`)

**Before:** If the `tickets` query returned no results, a `dummyTickets` array of 3 hardcoded tickets was displayed. `openTickets` count defaulted to `|| 2`.

**After:** Real data only. Empty state shows zero tickets / zero open tickets. `dummyTickets` array removed entirely.

### Dashboard Appointments (`client/pages/dashboard/Appointments.tsx`)

**Before:** "Add Reminder" button showed a placeholder toast: `"Feature coming soon"`.

**After:** Button navigates to `/dashboard/profile` where real SMS/email notification preferences can be managed.

---

## Verification

- `pnpm typecheck` — no errors
- `pnpm build` — clean
- No fake data paths remain in any production-visible UI component
