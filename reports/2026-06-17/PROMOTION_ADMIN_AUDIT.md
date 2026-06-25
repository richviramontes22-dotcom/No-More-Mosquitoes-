# Promotion Admin Management Audit
**Date:** 2026-06-17

## Question

Should admins manage promotions A) directly in the Stripe Dashboard, or B) through an internal Promotions page?

## Finding: Option B already exists, fully built and wired

`client/pages/admin/Promos.tsx` is a complete internal promotions management UI:
- Two tabs: **Promo Codes** and **Campaigns**
- Create codes (code, description, percent/fixed discount, min order, max uses, expiry) via a dialog form
- Table showing usage count vs. max uses, expiry, a "Synced"/"Local only" Stripe-sync status badge, and an active/inactive toggle
- Campaign CRUD linked to a promo code
- Routed at `/admin/promos` (`client/App.tsx`) and linked in the admin nav as "Promotions" under the Billing section (`client/pages/admin/AdminLayout.tsx`)
- Backed by a complete, already-shipped API: `server/routes/adminPromos.ts` (`requireAdmin`-protected CRUD + Stripe coupon/promotion-code sync on create, archive-on-delete)

This was not a stub — every piece (route, nav entry, page, backend) was already in place before this sprint. It simply was not visible to the customer because the *customer-facing* checkout had no promo input (see `PROMO_CODE_AUDIT_REPORT.md`), and that's a separate, now-fixed gap.

## Recommendation: Keep Option B (internal UI) — no new build needed

Building a second management surface, or recommending admins switch to the raw Stripe Dashboard, would be redundant and would fragment where promo state lives — the local `promo_codes` table (with `min_order_cents`, `max_uses`, `used_count`, app-side validation) has no Stripe Dashboard equivalent, so Stripe-only management would lose those constraints entirely. The existing internal page is simpler, more reliable, and lower-maintenance than introducing a parallel workflow, which is the standard this sprint's instructions asked to prioritize.

## What was fixed alongside this audit (not new scope — bug fixes to existing functionality)

1. **Stripe coupon `duration` bug** — `adminPromos.ts`'s coupon-creation call was missing the Stripe-required `duration` field, so the "Sync to Stripe" step silently failed for every code ever created through this page. Fixed (`duration: "once"`) — see `PROMO_CODE_IMPLEMENTATION_REPORT.md`.
2. **Untracked schema** — `promo_codes`/`campaigns`/the usage-counter RPC had no migration file in `db/migrations/`, breaking this project's migration-tracking convention. Backfilled with `db/migrations/2026-06-17_promo_codes_and_campaigns.sql`.

## Phase Z1 — Minimal Admin Integration

**Not implemented — not needed.** Phase Z1 only applies if Phase Z recommends Stripe Dashboard-only management (Option A), in which case a help card documenting the Stripe coupon/promotion-code creation flow would be added to the admin Billing area. Since Option B (the existing internal UI) is the recommendation, no help card is needed — admins should use `/admin/promos`, which already speaks for itself.
