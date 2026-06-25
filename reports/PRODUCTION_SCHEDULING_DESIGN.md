# PRODUCTION SCHEDULING DESIGN
## No More Mosquitoes — Future Scheduling System Architecture
## Date: 2026-05-28
## Status: Design Only — No Implementation

---

## Current State Summary

The existing scheduling system:
- Creates the first appointment at checkout via `confirm-booking`.
- Auto-generates recurring appointments daily via `generateRecurring.ts` within a 7-day lookahead.
- Respects business hours, blackout dates, and customer preferences (soft).
- Uses live employee count for capacity but has no load balancing.
- Annual plan subscriptions are excluded from auto-generation.
- Admin manually assigns technicians with no guidance or optimization.
- No SLA enforcement on assignment gap.

This design document describes the target state for a production-grade scheduling system.

---

## Design Goals (Priority Order)

1. **Customer satisfaction** — honor preferences when possible; never silently fail
2. **Appointment throughput** — maximize jobs per technician per day
3. **Travel efficiency** — minimize dead travel between jobs
4. **Capacity respect** — never exceed technician limits
5. **Preference handling** — customer preferences are PREFERRED not GUARANTEED

---

## Current vs Required Customer Availability Model

| Preference | Currently Captured | Currently Used | Should Exist |
|-----------|-------------------|----------------|--------------|
| Preferred first service date | YES (ScheduleFlow) | YES (appointment created at checkout) | YES |
| Preferred first service window | YES (ScheduleFlow) | YES | YES |
| Available weekdays | YES (preferredDays JSONB) | YES (soft, in generateRecurring) | YES |
| Available time windows | YES (preferredWindows JSONB) | YES (soft, in generateRecurring) | YES |
| Flexibility days | YES (flexibility_days JSONB) | NOT USED | Should expand slot search window |
| Access restrictions (gate codes) | YES (properties.gate_code) | NOT used in scheduling | Should be in assignment detail |
| Pets on property | NOT captured | N/A | Add to service_preferences |
| Service notes | YES (notes on appointment) | NOT used in scheduling | Should inform technician notes |
| Property-specific hazards | NOT captured | N/A | Add to service_preferences |

---

## Data Model Changes Needed

### 1. Extend `properties.service_preferences` JSONB

No migration needed — JSONB column accepts new keys. Add:

```json
{
  "preferred_days_of_week": [1, 2, 3],
  "preferred_windows": ["morning"],
  "flexibility_days": 3,
  "access_notes": "Gate code: 1234. Dog in backyard — please notify before entry.",
  "hazards": ["dog", "pool_chemicals"],
  "service_notes": "Sensitive plants near fence — avoid overspray",
  "contact_on_arrival": true,
  "contact_phone": "+15555551234"
}
```

Capture `access_notes`, `hazards`, and `service_notes` during onboarding or property edit.

### 2. Add `appointments.assignment_due_at` Column

```sql
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assignment_due_at TIMESTAMPTZ;
```

Set when appointment is created: `scheduled_date - 3 days`. Used to alert admin when unassigned appointments approach their deadline.

### 3. Add `assignments.preferred_technician_id` Column

```sql
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS preferred_technician_id UUID REFERENCES employees(id);
```

Allows customer or admin to note a preferred technician for consistency.

### 4. Add `technician_availability` Table

```sql
CREATE TABLE technician_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_available BOOLEAN NOT NULL DEFAULT true,
  max_jobs INTEGER DEFAULT 3,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Allows per-technician schedule configuration independent of global business hours.

### 5. Add `appointments.generation_source` Column

```sql
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS generation_source TEXT
  CHECK (generation_source IN ('checkout', 'webhook', 'recurring_cron', 'admin_manual', 'customer_schedule'));
```

Enables analytics on which path creates appointments and helps debug auto-generation issues.

---

## Scheduling Algorithm Design

### Phase 1: Slot Candidate Generation

**Input:** Subscription, property preferences, last appointment date

**Steps:**
1. Calculate `nextDueDateRange`:
   - `earliest = lastAppointmentDate + cadenceDays - flexibility_days`
   - `latest = lastAppointmentDate + cadenceDays + flexibility_days`
   - Default `flexibility_days = 0` if not set.
2. Expand flexibility: search `earliest` to `latest + SLOT_SEARCH_WINDOW (14)`.
3. Filter to operational days: check `business_hours.is_operational` for each day.
4. Filter out blackout dates.
5. Apply day-of-week preferences (preferred days): prefer these, but include all if preferences yield no candidates.
6. For each candidate day, collect available windows with remaining capacity.

**Output:** Ordered list of `(date, windowId)` candidates.

### Phase 2: Preference Scoring

Score each candidate slot against customer preferences. Higher score = better match.

**Scoring rubric:**

| Factor | Points |
|--------|--------|
| Day-of-week matches preferred days | +10 per match |
| Window matches preferred window | +8 per match |
| Date is within `flexibility_days` of exact due date | +5 |
| Date is within `flexibility_days × 2` | +3 |
| Technician has worked this property before | +6 |
| Technician is already in the same ZIP/city that day | +4 (reduces travel) |
| Slot has lower utilization (< 50% capacity used) | +2 |

**Tie-breaking:** Prefer earliest date.

### Phase 3: Slot Selection

1. Sort candidates by score descending.
2. Select the highest-scoring candidate.
3. If no candidate has score > 0 (no preferences match), select first available slot.
4. If no slot found in `earliest` to `latest + 14 days`:
   - Add to `noSlotFound` counter.
   - Create an `admin_scheduling_queue` entry (see Data Model below).
   - Trigger admin notification.

### Phase 4: Admin Assignment Guidance

After appointment is created, the system should suggest technician assignments:

1. For each appointment needing assignment, query all active technicians.
2. Score each technician:
   - Already assigned appointments in same ZIP code that day: +5
   - Has served this property before: +4
   - Current workload lower than average: +3
   - Is not at max capacity for window: required
3. Suggest top technician — admin can override.
4. Flag if assignment not made within `assignment_due_at`.

---

## Conflict Resolution

| Conflict | Resolution |
|----------|-----------|
| Customer preference vs no available slots | Expand to non-preferred days; notify customer |
| Two customers want same slot and capacity is 1 | First-come-first-served; second customer offered next available |
| Admin override to non-available window | Admin can override capacity check (admin writes bypass RLS) |
| Blackout date coincides with due date | Search forward for next available slot |
| Technician max capacity reached | Slot shows `remaining = 0`; not offered to customer |
| Annual plan customer (currently skipped) | Generate recurring appointments using `cadence_days`; do NOT set `program = "annual"` as a skip signal in generateRecurring |

**Recommended fix for annual plan conflict:** Change the skip condition in `generateRecurring.ts`:
```typescript
// Current (wrong for multi-visit annual plans):
if (program === "one_time" || program === "annual") { result.skipped++; continue; }

// Fixed (only skip truly non-recurring):
if (program === "one_time") { result.skipped++; continue; }
// Annual plans still have cadence_days — generate appointments normally
```

---

## Admin Override Capability

The admin scheduling system should support:

1. **Force-schedule** — admin can create appointment on any date regardless of business hours or blackout (with a confirmation warning).
2. **Override window** — admin can create appointment outside defined windows.
3. **Override capacity** — admin can book over capacity with explicit confirmation.
4. **Manual technician assignment** — always available, overrides any suggestion.
5. **Bulk reschedule** — move multiple appointments when a technician calls out sick.
6. **Emergency block** — fast blackout date creation affects all future availability immediately.

All overrides should be logged with `admin_user_id` and reason in an `admin_overrides` audit table.

---

## Customer Self-Service Reschedule

### Current State
`POST /api/appointments/:id/reschedule` exists and is functional. Customers can reschedule via the dashboard Appointments page.

### Improvements Needed

1. **Window for self-reschedule:** Block rescheduling within 24 hours of appointment (currently no restriction).
   ```typescript
   const hoursUntilAppt = (new Date(scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
   if (hoursUntilAppt < 24) throw { status: 400, message: "Reschedules must be made at least 24 hours in advance." };
   ```

2. **Reschedule count limit:** Max 3 reschedules per subscription period to prevent abuse.
   Add `reschedule_count INTEGER DEFAULT 0` to `appointments`.

3. **Preference update on reschedule:** If customer picks a different day-of-week repeatedly, update `service_preferences.preferred_days_of_week`.

4. **Communicate impact:** Warn customer that rescheduling may shift future recurring appointments (if preferred dates are updated).

---

## Annual Plan Scheduling Fix (High Priority)

Annual customers pay once but receive multiple treatments throughout the year (typically every 21 days = ~17 visits per year). The current code **completely skips annual subscriptions** in `generateRecurring.ts`.

**Recommended fix:**
1. Remove `"annual"` from the skip condition in `generateRecurring.ts` line 89.
2. Annual plan customers have `cadence_days` set correctly (e.g., 21 for biweekly-ish).
3. The `current_period_end` field (one year from purchase) should be used to stop generation after the annual period ends:
   ```typescript
   if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
     // Annual plan expired — skip and flag for renewal
     result.skipped++;
     continue;
   }
   ```
4. Add a "renewal required" alert for annual subscriptions approaching `current_period_end - 30 days`.

---

## Lookahead Window Recommendation

**Current:** 7 days (`ADVANCE_DAYS = 7`). Generates appointments 1 week out.
**Recommended:** 14 days for normal operation, 21 days for sparse markets.

Rationale: 7 days is tight — if the generation function fails one day or no slots are available for a week, the customer may have no appointment when due. A 14-day window provides a buffer and allows admin time to manually schedule if `noSlotFound` occurs.

---

## Notification Additions for Scheduling Events

| Event | Who | Channel | Trigger |
|-------|-----|---------|---------|
| Assignment created | Employee | Email or in-app | `POST /api/employee/notifications` on assignment upsert |
| Job completed | Customer | Email | Employee marks `completed` in server route |
| No slot found for subscription | Admin | Email/dashboard alert | After `runRecurringGeneration()`, if `result.noSlotFound > 0` |
| Unassigned appointment approaching (< 3 days) | Admin | Dashboard badge | Scheduled check or DB view |
| Annual plan expiring (< 30 days) | Customer + Admin | Email | New Netlify cron |
