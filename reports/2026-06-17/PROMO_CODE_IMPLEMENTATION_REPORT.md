# Promo Code Implementation Report
**Date:** 2026-06-17
**Scope:** Add Stripe-native promotion code support to the main onboarding checkout (one-time, annual, subscription), fix the bugs found in `PROMO_CODE_AUDIT_REPORT.md`, and back-fill the missing migration.

---

## Changes Made

### 1. `db/migrations/2026-06-17_promo_codes_and_campaigns.sql` (new)
Idempotent backfill of the `promo_codes`/`campaigns` tables and the `increment_promo_used_count` Postgres function, none of which had a tracked migration before. Safe to run against an environment where these already exist (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`).

**RLS added** (Supabase's editor flagged the initial draft for creating tables with no Row Level Security — correctly, since every other table in this codebase has it). Final policies:
- `promo_codes` / `campaigns`: admin-only `FOR ALL`, matching the existing convention from `2026-06-15_create_leads_tables.sql` (`profiles.role = 'admin'`).
- `promo_codes` additionally has a public `FOR SELECT USING (active = true)` policy, so `/api/promos/validate` (a public, unauthenticated endpoint) keeps working in any environment where `SUPABASE_SERVICE_ROLE_KEY` isn't set and the server falls back to the anon client — mirrors the pre-existing "Anyone can read active service_areas" pattern in `2025-05-20_admin_features_support.sql`.
- `increment_promo_used_count` was changed to `SECURITY DEFINER`: the pre-existing call site in `webhooksStripe.ts` invokes this RPC via the **anon** client (`supabase.rpc`, not `supabaseAdmin`), and a plain RLS-subject function would have had its internal `UPDATE` silently blocked for that caller once RLS was enabled — `SECURITY DEFINER` lets this one narrow, audited operation (increment-by-1 on active rows only) bypass RLS without granting anon/authenticated any direct `UPDATE` access to the table.

### 2. `server/routes/adminPromos.ts` — bug fix
Added the Stripe-required `duration: "once"` field to the coupon-creation call. Without it, every "Sync to Stripe" attempt was silently failing (caught as a non-fatal warning), leaving `stripe_coupon_id`/`stripe_promotion_code_id` null on every promo code ever created. `"once"` means the discount applies to the first invoice/charge only — the standard semantic for a promo code, and the one that makes recurring-plan discounts (below) work at all.

### 3. `server/routes/billingStripe.ts` — `POST /create-payment-intent`
- Accepts three new optional body fields: `promoDiscountCents`, `stripePromotionCodeId`, `promoDatabaseId` — same names/shape as the already-shipped marketplace checkout (`server/routes/marketplaceStripe.ts`), for consistency.
- **One-time / annual** (manual PaymentIntent, no Stripe Price object): the charge amount is reduced by `min(promoDiscountCents, originalAmount)`, floored at Stripe's 50-cent minimum — identical math to the marketplace flow. `metadata.promo_code_id` / `metadata.stripe_promotion_code_id` are attached to the PaymentIntent when present.
- **Subscription**: if `stripePromotionCodeId` is present, `discounts[0][promotion_code]` is added to the subscription-creation call — Stripe computes the discounted invoice/PaymentIntent amount itself; no manual math. `metadata.promo_code_id` is attached to the Subscription object (already-shared `meta`, just extended).
- **Guard**: if a promo was validated (`promoDatabaseId` present) for a subscription but it has no `stripePromotionCodeId` (e.g., a legacy code created before the duration-bug fix, never synced to Stripe), the endpoint returns a clear 400 instead of silently charging full price: *"This promo code isn't available for recurring plans yet. Try a one-time or annual plan, or contact support."*

### 4. `server/routes/billingStripe.ts` — `POST /confirm-booking`
Added `incrementPromoUsedCount(promoCodeId)` — the same atomic-RPC-with-fallback pattern already used in `webhooksStripe.ts` for the marketplace flow, reimplemented locally here (not shared as an import, to avoid touching the working marketplace webhook code at all). Called once payment is Stripe-confirmed (`pi.status === "succeeded"`), reading the promo ID back from **Stripe metadata** rather than trusting the request body:
- One-time/annual: `pi.metadata.promo_code_id` (attached directly to the PaymentIntent at creation).
- Subscription: fetches the subscription object via Stripe (`GET /subscriptions/:id`) and reads its metadata, since the invoice's PaymentIntent doesn't carry the Subscription-level metadata.

This closes the gap identified in the audit: the main flow previously had no usage-counting at all, meaning `max_uses` limits could never have been enforced for it even if a promo code had been entered.

### 5. `client/components/schedule/ScheduleFlow.tsx` — promo code UI
- New state: `promoInput`, `appliedPromo`, `promoError`, `promoLoading`.
- New handlers: `handleApplyPromo` (calls the existing public `/api/promos/validate` endpoint — no new validation endpoint was created, reusing what already exists) and `handleRemovePromo`.
- UI added to the Order Summary card on the payment step: an input + Apply button when no code is applied; a green "code applied" row with the discount amount and a Remove (×) button once one is. A Subtotal line appears above "Due today" once a discount is active.
- The payment-intent fetch effect now depends on `appliedPromo` (in addition to `step`) and clears the cached `clientSecret`/`intentId` whenever a promo is applied or removed, so a fresh, correctly-discounted PaymentIntent (or Subscription) is created. `PaymentStep` unmounts/remounts cleanly on this transition since its rendering is already gated on `paymentClientSecret` being non-null.
- **Subscription-specific guard**: if the validated code lacks a `stripe_promotion_code_id` and the customer is on the subscription plan, `handleApplyPromo` shows an inline error immediately, before ever calling `create-payment-intent` — avoiding a "discount applied" UI state that the backend would later reject.

---

## Why This Design

- **No custom discount engine.** Stripe is the source of truth for what's actually charged in both paths: manual amount-reduction for simple one-time/annual PaymentIntents (matching the existing, already-proven marketplace pattern), and Stripe's own `discounts[0][promotion_code]` for the genuinely-recurring case where hand-rolled math would have been wrong (or at least duplicative of logic Stripe already provides).
- **Consistency with existing code**, not a parallel implementation — field names (`promoDiscountCents`, `stripePromotionCodeId`, `promoDatabaseId`) and the validate-then-charge sequence match `marketplaceStripe.ts`/`CheckoutReview.tsx` exactly, so a developer who already understands the marketplace promo flow understands this one for free.
- **No negative totals possible** — `Math.max(50, ...)` floors the one-time/annual charge at Stripe's minimum; Stripe itself prevents a coupon from taking a subscription invoice below zero.

---

## Files Changed

- `db/migrations/2026-06-17_promo_codes_and_campaigns.sql` (new)
- `server/routes/adminPromos.ts`
- `server/routes/billingStripe.ts`
- `client/components/schedule/ScheduleFlow.tsx`

No changes to `server/routes/marketplaceStripe.ts`, `client/components/marketplace/CheckoutReview.tsx`, `client/pages/admin/Promos.tsx`, or `server/routes/webhooksStripe.ts` — all already correct and left untouched.
