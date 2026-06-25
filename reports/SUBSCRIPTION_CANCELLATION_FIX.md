# SUBSCRIPTION CANCELLATION CASCADE FIX
## Generated: 2026-05-29
## Phase 2 of the Final Operational Integrity Sprint

---

## Problem Confirmed

**Audit Reference:** CASCADE_RULE_AUDIT.md Event 4, INVALID_STATE_ANALYSIS.md IS-11

When Stripe fired `customer.subscription.deleted`, the webhook handler only updated `subscriptions.status = 'canceled'`. Future appointments for that subscription remained in `status = "scheduled"` and their linked assignments remained active. Technicians could be dispatched to jobs for customers who had already canceled.

---

## Fix Implemented

**File modified:** `server/routes/webhooksStripe.ts`

In the `customer.subscription.deleted` case:

1. **Before** updating the subscription status, the handler now looks up the local `subscriptions` row to get `user_id` and `property_id`.
2. **After** updating `subscriptions.status = "canceled"`, the handler cascades:
   - Finds all future appointments (scheduled_date >= today) for the user that are not already in a terminal status.
   - Sets those appointments to `status = "canceled"`.
   - Sets linked assignments to `status = "skipped"` (where not already terminal).
3. The entire cascade is wrapped in try/catch and is **non-fatal** — if the cascade fails, the subscription is still marked canceled and Stripe receives a 200 response (so it won't retry).

---

## User ID Resolution Pattern

The fix uses the same pattern as the `invoice.paid` handler (lines 415-432 in webhooksStripe.ts):

```typescript
const { data: subRow } = await supabase
  .from("subscriptions")
  .select("id, user_id, property_id")
  .eq("stripe_subscription_id", sub.id)
  .maybeSingle();
```

This is read **before** the status update so the row still exists with all fields populated.

---

## Code Change Summary

```typescript
case "customer.subscription.deleted": {
  const sub = object as any;

  // Resolve user_id from the local subscriptions row before updating status
  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("id, user_id, property_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id);

  // Cascade: cancel future appointments and skip their assignments.
  if (subRow?.user_id) {
    try {
      const db = supabaseAdmin ?? supabase;
      const today = new Date().toISOString().slice(0, 10);

      const { data: futureAppts } = await db
        .from("appointments")
        .select("id")
        .eq("user_id", subRow.user_id)
        .not("status", "in", '("completed","canceled","cancelled","canceled_by_admin","canceled_by_customer")')
        .gte("scheduled_date", today);

      if (futureAppts && futureAppts.length > 0) {
        const apptIds = futureAppts.map((a: any) => a.id);

        await db.from("appointments")
          .update({ status: "canceled" })
          .in("id", apptIds);

        await db.from("assignments")
          .update({ status: "skipped" })
          .in("appointment_id", apptIds)
          .not("status", "in", '("completed","skipped","no_show","canceled","cancelled")');

        console.log(`[Webhook] customer.subscription.deleted — canceled ${apptIds.length} future appointment(s)...`);
      }
    } catch (cascadeErr: any) {
      console.error("[Webhook] customer.subscription.deleted cascade failed (non-fatal):", cascadeErr.message);
    }
  }

  break;
}
```

---

## Idempotency

- `NOT IN` guards on both appointment and assignment updates ensure that re-running the webhook (Stripe retry) does not double-cancel already-terminal rows.
- The `user_id` lookup uses `maybeSingle()` — if no local subscription row exists (already deleted), the cascade is skipped gracefully.

---

## Design Decisions

**status = "canceled" not "canceled_by_admin":** The `appointments` CHECK constraint only includes `('requested', 'scheduled', 'completed', 'canceled')` in the initial schema. The status `canceled_by_admin` may not be in the live constraint (it is referenced in NOT IN guards but never written in audited migration files). Using `"canceled"` is safe and consistent with the admin cancel route.

**updated_at not included for assignments:** The `assignments` table has no `updated_at` column (confirmed from all migrations).

---

## Migration Required

None. Uses existing tables.

---

## Rollback

Revert the `customer.subscription.deleted` case in `webhooksStripe.ts` to the original 4-line version. No DB changes to reverse.
