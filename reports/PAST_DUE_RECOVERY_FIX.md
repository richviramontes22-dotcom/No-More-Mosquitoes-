# PAST DUE BILLING PORTAL ACCESS FIX
## Generated: 2026-05-29
## Phase 4 of the Final Operational Integrity Sprint

---

## Problem Confirmed

**Audit Reference:** CASCADE_RULE_AUDIT.md Event 6 (Payment failed)

`requireActiveSubscription()` in `billingStripe.ts` checks `status = 'active'` only. When Stripe fires `invoice.payment_failed`, the subscription status is set to `'past_due'`. A `past_due` customer who tries to access the Stripe Billing Portal to update their payment method receives a 403 error — they cannot self-remediate. This creates a deadlock: they can't pay, so they stay `past_due`, but `past_due` blocks the only way to fix the payment.

---

## Fix Implemented

**File modified:** `server/routes/billingStripe.ts` — `POST /api/billing/create-portal-session` route only.

**Approach chosen:** Option (a) — inline status check on the portal route that replaces `requireActiveSubscription`. This is the simplest and least risky change: one route is modified, all other routes continue to use the existing `requireActiveSubscription` guard unchanged.

The portal route now:
1. Still calls `getAuthenticatedUser(req)` — auth is fully enforced.
2. Queries subscriptions for `status IN ('active', 'past_due')` instead of only `status = 'active'`.
3. Throws 403 with a clear message if no active or past-due subscription is found.
4. Continues to create the Stripe Billing Portal session as before.

---

## Code Change

**Before:**
```typescript
router.post("/create-portal-session", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    await requireActiveSubscription(user);
    const customerId = await getOrCreateStripeCustomer(user);
```

**After:**
```typescript
router.post("/create-portal-session", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    // Allow active OR past_due subscriptions through to the portal.
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "past_due"])
      .limit(1)
      .maybeSingle();

    if (!sub) {
      throw Object.assign(
        new Error("An active or past-due subscription is required to access the billing portal."),
        { status: 403, code: "NO_BILLABLE_SUBSCRIPTION" },
      );
    }

    const customerId = await getOrCreateStripeCustomer(user);
```

---

## Routes NOT Affected

These routes still use `requireActiveSubscription` (active only — unchanged):
- `POST /api/billing/update-subscription-plan`
- `POST /api/billing/cancel-subscription`
- Any other billing endpoint that calls `requireActiveSubscription`

---

## Safety Analysis

- Authentication is still enforced — unauthenticated users cannot reach the portal query.
- The Stripe Billing Portal itself validates the customer's subscription status independently. Even if a customer with no valid subscription reached this endpoint, Stripe would reject the portal session creation.
- The change is minimal — only 1 route is affected.
- `canceled` and `expired` subscriptions cannot reach the portal (they are not in the `in("status", ...)` list).

---

## Migration Required

None.

---

## Rollback

Replace the inline status check with `await requireActiveSubscription(user);` in the `create-portal-session` route.
