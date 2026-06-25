# Scheduling Capacity and Annual Plan Fix Report
**Sprint:** Launch Blocker + High-Value Operational Fix Sprint  
**Date:** 2026-05-28

---

## P0.3 — Reschedule Capacity Fix

### What Changed

**File:** `server/routes/customerAppointments.ts`  
**Function:** `checkWindowAvailability()`  

**Old code (line 73):**
```typescript
const capacity = 1 * (windowDef.max_jobs_per_tech ?? 3);
```

**New code (lines 73–75):**
```typescript
const { data: activeTechs } = await db.from("employees").select("id").eq("status", "active");
const activeTechCount = (activeTechs && activeTechs.length > 0) ? activeTechs.length : 1;
const capacity = activeTechCount * (windowDef.max_jobs_per_tech ?? 3);
```

### Where the Fix Is

The capacity calculation is inside `checkWindowAvailability()`, called by the reschedule route `POST /api/appointments/:id/reschedule`. The `db` variable used for the employee query is `supabaseAdmin ?? supabase`, which was already defined at the module level.

### Validation

The `findAvailableSlot()` function in `generateRecurring.ts` already performed the correct dynamic technician count query:
```typescript
const { data: techs } = await db.from("employees").select("id").eq("status", "active");
const techCount = techs?.length || 1;
```
The reschedule capacity check now matches this pattern. The two implementations are now consistent.

### Consistency Check

| Location | Tech count method | Status |
|---|---|---|
| `generateRecurring.ts` → `findAvailableSlot()` | DB query | Was correct before sprint |
| `customerAppointments.ts` → `checkWindowAvailability()` | DB query | Fixed in this sprint |
| `availability.ts` (booking availability endpoint) | Not checked in this sprint | Should be audited |

---

## P0.4 — Annual Recurring Generation Fix

### What the Old Skip Condition Was

```typescript
// Skip non-recurring programs
if (program === "one_time" || program === "annual") {
  result.skipped++;
  continue;
}
```

This meant **all** annual plan subscribers were skipped, regardless of whether their paid period was active. A customer who paid for an annual plan received their first manually-scheduled appointment (from checkout), but the recurring generation cron never created follow-up appointments.

### What the New Logic Is

The subscription SELECT query was extended to fetch `current_period_end`:
```typescript
.select("id, user_id, property_id, cadence_days, current_period_end")
```

The skip logic was split into two separate conditions:

```typescript
// Skip one-time programs entirely — no recurring generation
if (program === "one_time") {
  result.skipped++;
  continue;
}
// Annual plans: only generate appointments while the paid period is active.
if (program === "annual") {
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  if (!periodEnd || periodEnd <= new Date()) {
    result.skipped++;
    continue;
  }
}
```

Annual plans with `current_period_end > now` proceed through the full slot-finding and idempotency checks.

### Expiry Guard Behavior

| Scenario | Behavior |
|---|---|
| Annual plan, `current_period_end` is null | Skipped (conservative) |
| Annual plan, `current_period_end` is in the past | Skipped (expired) |
| Annual plan, `current_period_end` is in the future | Proceeds to slot-finding and appointment generation |
| Annual plan, appointment already exists (idempotency guard) | Skipped (correct) |

### How `current_period_end` Is Set for Annual Plans

Annual plans use a PaymentIntent (not a Stripe Subscription). The `current_period_end` is set in two places:
1. `POST /api/billing/confirm-booking` — sets `current_period_end = now + 365 days` when the payment is confirmed by the client
2. `payment_intent.succeeded` webhook — sets the same value as a fallback for direct/dashboard charges

Both use `upsert` on `stripe_subscription_id`, so they are idempotent.

---

## Area-Specific Business Hours

### Status: Deferred

The slot-finding function in `generateRecurring.ts` only queries global business hours:
```typescript
const { data: hoursRows } = await db
  .from("business_hours")
  .select("day_of_week, is_operational, windows")
  .is("service_area_id", null); // global only
```

The customer-facing reschedule availability check in `customerAppointments.ts` does attempt to match service-area-specific hours:
```typescript
const hoursRow =
  hoursRows?.find((r: any) => serviceAreaId && r.service_area_id === serviceAreaId) ??
  hoursRows?.find((r: any) => !r.service_area_id);
```

The recurringGeneration function doesn't know the property's `service_area_id`, and adding that join was out of scope for this sprint. For properties in service areas with different hours than global defaults, the generated appointments may not respect area-specific windows.

**Why deferred:**
- The `properties` table likely has a `service_area_id` but the query in `generateRecurring.ts` would need to be updated to join on it
- This is an edge case for multi-area deployments — single-area operators are unaffected
- Deferred to a dedicated scheduling audit sprint

---

## Remaining Scheduling Gaps

1. **Service area business hours in recurring generation** — `findAvailableSlot()` uses global hours only. Area-specific hours are ignored for auto-generated appointments.

2. **Availability endpoint audit** — The `server/routes/availability.ts` endpoint (used for customer-facing booking date selection) was not audited in this sprint. It may have its own capacity calculation that needs the same dynamic-tech-count fix.

3. **No-slot escalation path** — When a ticket is created for a scheduling failure, there is no automated re-attempt mechanism. The operations team must manually schedule the appointment after seeing the ticket.

4. **Annual plan renewal reminder** — When `current_period_end` approaches, no renewal reminder is sent to the customer. This is a revenue risk. A Netlify scheduled function should be added to send reminders 30/14/7 days before expiry.
