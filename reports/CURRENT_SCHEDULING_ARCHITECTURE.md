# CURRENT SCHEDULING ARCHITECTURE
## No More Mosquitoes — Scheduling System Deep Dive
## Date: 2026-05-28

---

## Q1: How Are Appointments Currently Created?

There are four distinct paths that create appointment rows:

### Path 1: Inline Checkout (Primary)
**File:** `server/routes/billingStripe.ts` — `POST /api/billing/confirm-booking`

Triggered by: customer completing Stripe PaymentElement in `ScheduleFlow.tsx`.

After verifying PI status with Stripe, inserts into `appointments`:
```
status: "scheduled"
user_id, property_id, scheduled_date, window, window_label, scheduled_at, notes
```
Idempotency guard: counts existing appointments for same `user_id` + `property_id` + `scheduled_date` before inserting.

### Path 2: Webhook Fallback (Safety Net)
**File:** `server/routes/webhooksStripe.ts` — `checkout.session.completed` handler

Triggered by: Stripe webhook for subscription sessions.

Same idempotency check as Path 1. Creates appointment from session metadata fields: `scheduled_date`, `window_id`, `window_label`, `window_start`, `op_notes`.

### Path 3: Legacy Schedule Form
**File:** `server/routes/schedule.ts` — `handleScheduleRequest()`

Triggered by: `POST /api/schedule` from `client/pages/Schedule.tsx`.

Creates appointment with `status: "requested"` for authenticated users with a real `propertyId`. Also captures `schedule_requests` row for all submissions (lead capture). Sends confirmation email.

### Path 4: Recurring Auto-Generation
**File:** `server/services/appointments/generateRecurring.ts` — `runRecurringGeneration()`

Triggered by: Netlify cron at 08:00 UTC daily.

Creates appointments for active subscription customers whose next due date is within 7 days and who have no future appointment scheduled.

---

## Q2: How Are Recurring Appointments Generated?

**File:** `server/services/appointments/generateRecurring.ts`
**Trigger:** `netlify/functions/generate-appointments.ts` → Netlify cron `0 8 * * *`

Algorithm:
1. Query `subscriptions` where `status = "active"` and `property_id IS NOT NULL` and `cadence_days IS NOT NULL`.
2. Batch-load property `program` and `service_preferences` for all subscription property IDs.
3. Skip subscriptions where `property.program === "one_time"` or `"annual"`.
4. For each remaining subscription:
   - Check if a future non-canceled appointment exists for this `property_id` + `user_id`. If yes, skip (idempotent).
   - Find last non-canceled appointment to anchor the next due date.
   - Calculate: `nextDue = lastAppointmentDate + cadenceDays`.
   - Skip if `nextDue > today + ADVANCE_DAYS (7)`.
   - Call `findAvailableSlot(nextDue, today, preferredDays, preferredWindows)`.
5. `findAvailableSlot()` walks calendar days from `nextDue` to `nextDue + SLOT_SEARCH_WINDOW (14)`:
   - Skips blackout dates.
   - Skips non-operational days per `business_hours`.
   - Respects preferred day-of-week and preferred window (soft — retried without preferences if no match).
   - Checks booked count vs capacity for each window.
6. Insert appointment row for found slot.
7. Returns `GenerationResult` with counts.

**Constants:**
- `ADVANCE_DAYS = 7` — how far ahead to generate
- `SLOT_SEARCH_WINDOW = 14` — how far to search for a slot
- `DRY_RUN = process.env.APPOINTMENT_GEN_DRY_RUN === "true"` — safe testing mode

---

## Q3: How Are Appointments Assigned to Technicians?

**File:** `client/pages/admin/Appointments.tsx` — bulk assign action

**Mechanism:**
1. Admin selects one or more appointments via checkbox.
2. Admin picks a technician from a dropdown populated by querying `employees` (joined with `profiles` for names).
3. Client calls `supabase.from("assignments").upsert(selectedIds.map(...))`.
4. Upsert creates or updates rows in `assignments` with `appointment_id`, `employee_id`, `status: "assigned"`.

**No server-side route is used for assignment creation** — it's a direct Supabase client call from the admin frontend. The `assignments` table RLS must allow admin users to write.

**Gap:** No notification sent to the employee when a new assignment is created.

---

## Q4: How Is Slot Availability Calculated?

**File:** `server/routes/availability.ts` — `GET /api/availability`
**Also:** `server/routes/schedule.ts` — `checkWindowAvailability()` (server-side re-validation)

**Formula:**
```
slot_capacity = activeTechCount × window.max_jobs_per_tech
slot_remaining = slot_capacity - bookedCount
slot_available = slot_remaining > 0
```

**Steps:**
1. Count active employees: `SELECT id FROM employees WHERE status = 'active'`. Fallback to 1 if empty.
2. Fetch `business_hours` for the date range, prefer area-specific over global.
3. Fetch `blackout_dates` for the date range.
4. Count active appointments (`status IN ("requested","scheduled","confirmed")`) per `scheduled_date` + `window`.
5. For each day in range:
   - Skip if in past.
   - Skip if blackout.
   - Use `hours.is_operational` to determine if day is available.
   - For each window in `hours.windows`:
     - `capacity = activeTechCount × win.max_jobs_per_tech`
     - `booked = count of appointments for date+window`
     - `remaining = max(0, capacity - booked)`
     - `available = remaining > 0`

**Gap in reschedule path:** `customerAppointments.ts` `checkWindowAvailability()` line 73 hardcodes `capacity = 1 * (windowDef.max_jobs_per_tech ?? 3)`. Does not query live employee count. This is inconsistent with the booking and availability API paths.

---

## Q5: How Are Cancellations Handled?

### Customer-Initiated Cancellation
No direct customer cancel endpoint exists. Customers can cancel their Stripe subscription via `POST /api/billing/cancel-subscription`, which:
1. Finds active Stripe subscription for the property.
2. Calls Stripe `DELETE /subscriptions/{id}` (cancel at period end).
3. Updates `profiles.subscription_metadata` with cancellation timestamp.
4. Webhook `customer.subscription.deleted` fires later and sets `subscriptions.status = "canceled"`.

**Gap:** Individual appointment cancellation by customer is not implemented. Customers can only cancel the subscription.

### Admin-Initiated Cancellation
**File:** `server/routes/adminAppointments.ts` — `PATCH /api/admin/appointments/:id/cancel`

1. Validates appointment is not already canceled or completed.
2. Sets `appointments.status = "canceled"`.
3. Sends cancellation email to customer via Resend.
4. Logs notification to `notification_log`.

**RLS Note:** Admin cancellation uses `supabaseAdmin` (service role). Direct Supabase client calls from the admin frontend would also need the user to have admin-level RLS rights.

---

## Q6: How Are Reschedules Handled?

### Customer Self-Service Reschedule
**File:** `server/routes/customerAppointments.ts` — `POST /api/appointments/:id/reschedule`

1. Authenticates user via JWT Bearer token.
2. Verifies appointment belongs to the user.
3. Rejects if appointment is canceled or completed.
4. Checks availability for the new slot (blackout + business hours + capacity check, excluding the current appointment from count).
5. Updates `appointments.scheduled_date`, `window`, `window_label`, `scheduled_at`, `status = "scheduled"`.
6. Sends reschedule confirmation email (fire-and-forget).

**Gap:** Capacity check in `customerAppointments.ts` uses hardcoded `capacity = 1 * max_jobs_per_tech`. Does not reflect real technician count.

### Admin Reschedule
**File:** `client/pages/admin/Appointments.tsx` — inline date/window edit fields

Admin can directly edit appointment date and window via the appointments table UI. Changes are written via Supabase direct (no server route). No availability check is enforced on admin reschedule — admin can override to any date.

---

## Q7: How Are Technician Workloads Balanced?

**Short answer: They are not.** There is no load balancing logic.

The current system:
- Calculates total capacity as `techCount × max_jobs_per_tech` across all technicians combined.
- Does not track which technician is assigned to which slot.
- Recurring appointment generation picks the first available slot in the first window that has remaining capacity.
- Admin bulk-assign manually selects a technician; no balancing algorithm exists.

**Effectively:** The capacity ceiling prevents overbooking, but when admins assign technicians, there is no system guidance on workload distribution.

---

## Q8: How Are Customer Preferences Captured and Used?

### Capture
**File:** `client/components/schedule/ScheduleFlow.tsx`

During onboarding, the flow collects:
- `preferredDays` — array of day-of-week numbers (0=Sun, 6=Sat)
- `preferredWindows` — array of window IDs (e.g., `["morning", "afternoon"]`)
- `flexibilityDays` — number of days of scheduling flexibility

These are sent to `confirm-booking` and persisted to `properties.service_preferences` as JSONB:
```json
{
  "preferred_days_of_week": [1, 2, 3],
  "preferred_windows": ["morning"],
  "flexibility_days": 3
}
```

Also stored in Stripe PaymentIntent metadata (`pref_days`, `pref_windows`, `flex_days`) and written by the `checkout.session.completed` webhook as well.

### Usage
**File:** `server/services/appointments/generateRecurring.ts` — `findAvailableSlot()`

- `preferredDays` checked per calendar day during slot search: if preferred days are set and current day is not in the list, skip.
- `preferredWins` checked per window: if preferred windows are set and current window is not in the list, skip.
- If no slot found within `SLOT_SEARCH_WINDOW` due to preference filtering, retries the entire search without preferences.

**Not used for:**
- Manual admin scheduling (admin picks date/window freely)
- The `GET /api/availability` response (preferences not applied to what the customer sees)

---

## Q9: How Are Blackout Dates Enforced?

**Tables:** `blackout_dates`

**Enforcement Points (4 separate code paths):**

1. **Availability API** (`server/routes/availability.ts`): Blackout dates fetched for the date range and stored in `blackoutMap`. Any date in the map has `is_blackout: true` and `is_operational: false` in the response, so no windows are shown.

2. **Booking validation** (`server/routes/schedule.ts` — `checkWindowAvailability()`): Re-validates before creating an appointment from the schedule form.

3. **Reschedule validation** (`server/routes/customerAppointments.ts` — `checkWindowAvailability()`): Re-validates before rescheduling.

4. **Recurring generation** (`server/services/appointments/generateRecurring.ts` — `findAvailableSlot()`): Fetches all blackout dates in the slot search window and skips blacked-out dates.

**Scope logic:**
- `scope = "all"` — blocks all service areas on that date.
- `scope = "service_area"` — blocks only the referenced service area.
- `scope = "employee"` — reserved for future per-technician blackouts, not yet implemented.

**Admin management:** `GET|POST|DELETE /api/admin/blackout-dates` via `server/routes/adminBlackoutDates.ts`. Admin UI at `/admin/appointments`.

---

## Q10: How Are Business Hours Enforced?

**Tables:** `business_hours`

**Structure:** Each row defines one day-of-week (0–6). `windows` is a JSONB array of window objects:
```json
[
  {"id": "morning", "label": "Morning (8AM–12PM)", "start": "08:00", "end": "12:00", "max_jobs_per_tech": 3},
  {"id": "afternoon", "label": "Afternoon (12PM–4PM)", "start": "12:00", "end": "16:00", "max_jobs_per_tech": 3}
]
```

**Enforcement Points:**

1. **Availability API**: Fetches all `business_hours` rows, prefers area-specific over global. If `is_operational = false` for the day, day returns `is_operational: false` with no windows.

2. **Booking validation** (`checkWindowAvailability()` in `schedule.ts`): Checks `is_operational` for the day and validates that the selected `windowId` exists in the day's windows array.

3. **Reschedule validation** (same function in `customerAppointments.ts`): Same check.

4. **Recurring generation**: Fetches global `business_hours` (area-specific not loaded in `findAvailableSlot()`). Skips non-operational days, iterates only available windows.

**Gap:** Recurring generation (`findAvailableSlot()`) only loads global business hours (`WHERE service_area_id IS NULL`). Service-area-specific hour overrides are ignored for auto-generated appointments.

---

## Database Tables Involved in Scheduling

| Table | Role |
|-------|------|
| `appointments` | Core scheduling record |
| `assignments` | Links appointment to employee; tracks lifecycle |
| `subscriptions` | Tracks subscription program, cadence_days, property_id |
| `properties` | Stores service_preferences (preferred days/windows), acreage, lat/lng |
| `business_hours` | Defines operational days and arrival windows per day |
| `blackout_dates` | Blocks scheduling on specific dates |
| `employees` | Active employee count for capacity calculation |
| `service_areas` | Geographic zones referenced by business_hours and blackout_dates |
| `schedule_requests` | Lead capture from public schedule form (not appointment planning) |

---

## Time Window Definitions

Stored in `business_hours.windows` JSONB column, seeded by migration `2026-05-16_phase1_reliable_availability.sql`:

| Day | Windows |
|-----|---------|
| Sunday | None (is_operational = false) |
| Monday–Friday | Morning (08:00–12:00, max 3/tech), Afternoon (12:00–16:00, max 3/tech) |
| Saturday | Morning (08:00–12:00, max 2/tech) |

Window IDs are strings (`"morning"`, `"afternoon"`). The system supports arbitrary window IDs — new windows can be added via the business hours admin UI without code changes.

---

## The `cadence_days` Field

**Location:** `subscriptions.cadence_days` (INTEGER)

**Values:** 14 (biweekly), 21 (every 3 weeks), 30 (monthly), 42 (6-week), or any custom number.

**How it is set:**
- Written by `confirm-booking` when processing a checkout.
- Written by `invoice.paid` webhook (via subscription metadata).
- Also stored in `properties.cadence` (INTEGER) for display.

**How it is used:**
- `generateRecurring.ts`: `nextDue = lastAppointmentDate + cadenceDays` — this is the target date for the next appointment.
- Pricing: `cadenceDays` is an input to `findStripePriceAsync()` which selects the correct Stripe price tier.

**For annual plans:** The `cadence_days` on the subscription is the treatment interval (e.g., 21), NOT 365. However, annual subscriptions are skipped by `generateRecurring.ts`, so this value is currently unused for annual plan recurring generation.

---

## Gap Between "Appointment Created" and "Appointment Assigned"

**Gap: Unlimited — no SLA enforced**

1. Appointment is created at checkout (status: `"scheduled"`).
2. It appears in the admin appointments table immediately.
3. Admin must manually select the appointment and assign a technician (bulk assign action in the admin UI).
4. There is no automated assignment, no priority queue, no assignment suggestion.
5. There is no alert or escalation if an appointment is unassigned within X days of its scheduled date.
6. Employee only learns of the assignment by checking their portal (no push notification).

The effective "gap" depends entirely on how frequently the admin reviews the appointments table. There is no system-enforced deadline.

---

## Summary of Architecture Gaps

| Gap | Impact |
|-----|--------|
| Annual plan subscriptions skipped by `generateRecurring` | All recurring visits for annual customers need manual scheduling |
| `findAvailableSlot()` uses only global business hours | Area-specific hour overrides ignored for auto-scheduling |
| No load balancing across technicians | Admin must manually distribute workload |
| No employee notification on assignment | Technicians must poll portal for new assignments |
| No customer notification on job completion | Customers must check dashboard manually |
| Reschedule capacity check hardcoded at 1 technician | Reschedule slots may under-report available capacity |
| No admin alert on `noSlotFound` | Silent failure when recurring generation cannot find a slot |
| No SLA on appointment assignment | Appointments can sit unassigned indefinitely |
