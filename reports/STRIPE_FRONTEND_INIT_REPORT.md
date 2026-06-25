# Stripe Frontend Initialization Report
**Date:** 2026-06-03

---

## `client/lib/stripe.ts` — Current State

```typescript
import { loadStripe } from "@stripe/stripe-js";

// Shared Stripe instance — import this wherever stripePromise is needed
// to avoid creating multiple instances.
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");
```

**Unchanged from original.** The refactoring today only MOVED this code from inline in `App.tsx` to this shared module.

---

## `client/App.tsx` — Stripe Elements Wrapper

**Before today:**
```typescript
import { loadStripe } from "@stripe/stripe-js";
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");
```

**After today:**
```typescript
import { stripePromise } from "@/lib/stripe";  // moved to line 113 (after QueryClient)
```

**Is the import position a bug?** No. ES module `import` declarations are always hoisted by the JavaScript runtime and bundlers (Vite/ESBuild) regardless of their position in the file. The `stripePromise` value is always available when needed.

**`VITE_STRIPE_PUBLISHABLE_KEY` usage:** Correct — uses `import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY` which Vite bakes in at build time.

---

## `client/components/schedule/PaymentStep.tsx` — NEW FILE (today)

```typescript
import { stripePromise } from "@/lib/stripe";

const PaymentStep = ({ clientSecret, ... }) => (
  <Elements
    stripe={stripePromise}
    options={{ clientSecret, ... }}
  >
    <PaymentForm ... />
  </Elements>
);
```

**Is this correct?** YES. Creates a scoped `<Elements>` provider with the per-payment `clientSecret`. Only renders when `clientSecret` is a non-null string.

**ScheduleFlow condition:**
```tsx
{paymentClientSecret && !isLoadingPayment && (
  <PaymentStep clientSecret={paymentClientSecret} ...>
```

`PaymentStep` only mounts when `paymentClientSecret` is truthy. The Stripe elements error would not come from this component if the API is reachable.

---

## Feature Flag Check

`ENABLE_INLINE_PAYMENT` flag exists in `server/lib/featureFlags.ts`:
```typescript
inlinePayment: () => boolFlag("ENABLE_INLINE_PAYMENT", true),
```

Default is `true` — inline payment is enabled by default. No frontend flag gate exists that would disable payment loading.

---

## Conclusion

The frontend Stripe initialization is **correct and unchanged in behavior**. The "cannot validate" error is a downstream symptom of the backend function crash, not a frontend code bug.

If `VITE_STRIPE_PUBLISHABLE_KEY` IS set in Netlify and the backend function IS running, the PaymentElement will render correctly.
