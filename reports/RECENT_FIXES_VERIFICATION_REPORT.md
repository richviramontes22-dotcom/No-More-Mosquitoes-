# RECENT FIXES VERIFICATION REPORT

**Sprint B1 — Fix Evidence Audit**
**Date:** 2026-05-28

Each of the 9 previously reported fixes is verified by exact file and line number.

---

## Fix 1 — Stripe Production Test-Key Block

**Claim:** `assertStripeKeyNotTestInProduction()` called in `createServer()` before any route is registered.

**Evidence:**
- **File:** `server/index.ts`
- **Line 2:** `import { assertStripeKeyNotTestInProduction } from "./lib/stripeMode";`
- **Line 40:** `assertStripeKeyNotTestInProduction();` — called as the very first statement inside `createServer()`, before `const app = express()`.
- **File:** `server/lib/stripeMode.ts` lines 8–19: Implementation throws `[FATAL]` if `NODE_ENV === "production"` and key starts with `sk_test_`.

**Status: VERIFIED**

---

## Fix 2 — Test Payment Endpoint Guard (Production Block)

**Claim:** `POST /api/billing/create-and-attach-payment-method` is blocked in production.

**Evidence:**
- **File:** `server/routes/billingStripe.ts`
- **Lines 1012–1016:**
```ts
router.post("/create-and-attach-payment-method", async (req, res) => {
  // Test-only endpoint: block in production to prevent accidental token-based card attachment.
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production." });
  }
```

**Status: VERIFIED**

---

## Fix 3 — Reschedule Capacity (Dynamic Employee Query)

**Claim:** Customer reschedule uses live active employee count, not a hardcoded constant.

**Evidence:**
- **File:** `server/routes/customerAppointments.ts`
- **Lines 73–75 (inside `checkWindowAvailability`):**
```ts
const { data: activeTechs } = await db.from("employees").select("id").eq("status", "active");
const activeTechCount = (activeTechs && activeTechs.length > 0) ? activeTechs.length : 1;
const capacity = activeTechCount * (windowDef.max_jobs_per_tech ?? 3);
```

**Status: VERIFIED**

---

## Fix 4 — Annual Generation Fix (Skip Expired Annual Plans)

**Claim:** `generateRecurring.ts` skips annual plans where `current_period_end` has passed.

**Evidence:**
- **File:** `server/services/appointments/generateRecurring.ts`
- **Lines 95–101:**
```ts
if (program === "annual") {
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  if (!periodEnd || periodEnd <= new Date()) {
    result.skipped++;
    continue;
  }
}
```
- **Line 59:** `current_period_end` included in subscription SELECT.

**Status: VERIFIED**

---

## Fix 5 — Card Detail Sync to Profiles

**Claim:** Real card details (last4, brand, expiry) synced to `profiles` table on payment.

**Sub-fix 5a — `invoice.paid` webhook:**
- **File:** `server/routes/webhooksStripe.ts`
- **Lines 503–521:**
```ts
try {
  const stripe = getStripeClient();
  if (stripe && resolvedUserId) {
    const pmId = invoice.default_payment_method ?? invoice.payment_intent;
    if (pmId && typeof pmId === "string" && pmId.startsWith("pm_")) {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      if (pm.card) {
        const expMonth = String(pm.card.exp_month).padStart(2, "0");
        const expYear  = String(pm.card.exp_year).slice(-2);
        const dbWrite  = supabaseAdmin ?? supabase;
        await dbWrite.from("profiles").update({
          card_last4:  pm.card.last4,
          card_brand:  pm.card.brand,
          card_expiry: `${expMonth}/${expYear}`,
        }).eq("id", resolvedUserId);
      }
    }
  }
} catch (pmErr: any) {
  console.error("[webhook] Failed to sync payment method:", pmErr.message);
}
```

**Sub-fix 5b — `attach-payment-method` billing route:**
- **File:** `server/routes/billingStripe.ts`
- **Lines 1084–1092:**
```ts
if (pm.card) {
  const expMonth = String(pm.card.exp_month).padStart(2, "0");
  const expYear  = String(pm.card.exp_year).slice(-2);
  await supabaseAdmin.from("profiles").update({
    card_last4:  pm.card.last4,
    card_brand:  pm.card.brand,
    card_expiry: `${expMonth}/${expYear}`,
  }).eq("id", user.id);
}
```

**Status: VERIFIED (both paths)**

---

## Fix 6 — Employee Assignment Route (`POST /assignments`)

**Claim:** `POST /api/admin/assignments` exists in `adminAppointments.ts` and upserts to `assignments` table.

**Evidence:**
- **File:** `server/routes/adminAppointments.ts`
- **Lines 212–263:** Full `router.post("/assignments", requireAdmin, ...)` implementation.
- **Line 233:** `db.from("assignments").upsert(upserts, { onConflict: "appointment_id" })` — upserts with status `"scheduled"`.
- **Mounting:** `server/index.ts` line 149: `app.use("/api/admin", adminAppointmentsRouter)` — route resolves to `POST /api/admin/assignments`.

**Client call confirmed:**
- **File:** `client/pages/admin/Appointments.tsx`
- **Line 541:** `adminApi("/api/admin/assignments", "POST", { appointment_ids: ids, employee_id: assignTech })`

**Status: VERIFIED**

---

## Fix 7 — Completion Notification

**Claim:** When employee marks assignment `completed`, a notification email is sent to the customer.

**Evidence:**
- **File:** `server/routes/employeeAssignments.ts`
- **Lines 227–293:** On `status === "completed"`: fetches appointment, profile, checks for media, logs intent, sends email via Resend if configured, logs to `notification_log`.
- **Lines 259–275:** Constructs and sends HTML email with dashboard link and optional media note.

**Status: VERIFIED**

---

## Fix 8 — No-Slot Admin Alert (Ticket Insert)

**Claim:** When `generateRecurring.ts` cannot find a slot, it creates an admin-visible ticket in the `tickets` table.

**Evidence:**
- **File:** `server/services/appointments/generateRecurring.ts`
- **Lines 163–185:**
```ts
try {
  const today2 = toDateStr(new Date());
  const alertSubject = `Scheduling: no slot found for subscription ${sub.id}`;
  const { data: existingTicket } = await db
    .from("tickets")
    .select("id")
    .eq("subject", alertSubject)
    .gte("created_at", `${today2}T00:00:00Z`)
    .maybeSingle();

  if (!existingTicket) {
    await db.from("tickets").insert({
      subject:     alertSubject,
      description: `Recurring appointment could not be scheduled. Subscription: ${sub.id}, ...`,
      status:      "open",
      priority:    "high",
      user_id:     sub.user_id,
      created_at:  new Date().toISOString(),
    });
  }
} catch (alertErr: any) {
  console.error("[recurring] Failed to create scheduling alert:", alertErr.message);
}
```

Ticket is deduplicated per day per subscription (checks for existing ticket with same subject today).

**Status: VERIFIED**

---

## Fix 9 — Property Coordinate Persistence

**Claim:** `parcelQuote.ts` persists `lat/lng` to `properties` table when `propertyId` is provided.

**Evidence:**
- **File:** `server/routes/parcelQuote.ts`
- **Lines 60–63:**
```ts
if (propertyId && typeof lat === "number" && typeof lng === "number") {
  const db = supabaseAdmin ?? supabase;
  void Promise.resolve(db.from("properties").update({ lat, lng }).eq("id", propertyId)).catch(() => {});
}
```

Non-fatal (void + catch) — coordinate write failure never blocks the quote response.

**Status: VERIFIED**

---

## Summary Table

| # | Fix | File | Lines | Status |
|---|-----|------|-------|--------|
| 1 | Stripe prod test-key block | `server/index.ts`, `server/lib/stripeMode.ts` | 40, 8–19 | VERIFIED |
| 2 | Test payment endpoint guard | `server/routes/billingStripe.ts` | 1014–1016 | VERIFIED |
| 3 | Reschedule dynamic capacity | `server/routes/customerAppointments.ts` | 73–75 | VERIFIED |
| 4 | Annual generation fix | `server/services/appointments/generateRecurring.ts` | 95–101 | VERIFIED |
| 5 | Card detail sync (webhook + billing) | `server/routes/webhooksStripe.ts` + `billingStripe.ts` | 503–521, 1084–1092 | VERIFIED |
| 6 | Employee assignment route | `server/routes/adminAppointments.ts` | 212–263 | VERIFIED |
| 7 | Completion notification | `server/routes/employeeAssignments.ts` | 227–293 | VERIFIED |
| 8 | No-slot admin alert | `server/services/appointments/generateRecurring.ts` | 163–185 | VERIFIED |
| 9 | Property coordinate persistence | `server/routes/parcelQuote.ts` | 60–63 | VERIFIED |

**All 9 fixes confirmed in code. No missing or incorrect implementations found.**
