# Report 23 — Hero Quote Flow Final Report

**Sprint:** Hero Quote Flow / Customer Funnel Cleanup  
**Phase:** 23  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## VERDICT: FULL GO

All validation gates passed. All constraints honored. All flows intact. Changes are ready to commit.

---

## Validation Gate Summary

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `pnpm typecheck` | ✅ Exit 0, 0 errors |
| Tests | `pnpm test` | ✅ Exit 0, 223/223 |
| Client build | `pnpm build:client` | ✅ Exit 0, 3503 modules |
| Server build | `pnpm build:server` | ✅ Exit 0, 688.04 kB |
| Functions bundle | `pnpm bundle:functions` | ✅ Exit 0, 7 functions |

---

## Changes Shipped

| # | File | Change | Risk |
|---|------|--------|------|
| 1 | `client/lib/translations.ts` | `checkPricing: "See Pricing"` → `"How Pricing Works"` (English) | Minimal |
| 2 | `client/components/sections/HeroSection.tsx` | Phone CTA demoted from equal-weight button to text link below hero buttons | Minimal |

---

## Constraint Compliance

| Constraint | Status |
|-----------|--------|
| Do not push automatically | ✅ Honored — no push executed |
| Do not deploy automatically | ✅ Honored — no deploy executed |
| Do not remove the quote widget | ✅ Honored — QuoteWidgetSection untouched on all 3 pages |
| Do not remove all ways for customers to schedule service | ✅ Honored — QuoteWidget "Schedule Service" CTA unchanged |
| Do not remove all ways for customers to call or text | ✅ Honored — phone `tel:` link still present in hero |
| Do not bypass address-based pricing logic | ✅ Honored — parcel/quote logic untouched |
| Do not break quote, pricing, onboarding, scheduling, billing, dashboard, marketplace, or contact flows | ✅ Honored — only labels and button placement changed |
| Do not change Stripe checkout | ✅ Honored — no Stripe files touched |
| Do not mutate real customer data | ✅ Honored — no DB writes |
| Do not charge real cards | ✅ Honored — no Stripe logic touched |
| Do not send live SMS | ✅ Honored — no notification code touched |
| Do not weaken auth guards or RLS policies | ✅ Honored — no auth files touched |
| Do not commit .env files or secrets | ✅ Honored — none staged |

---

## What Changed and Why

### Change 1: "See Pricing" → "How Pricing Works"

The label "See Pricing" created a false expectation: users who clicked it expected to see a
price table but arrived at `/pricing`, which opens immediately into the same address-entry
quote widget already present on the homepage. "How Pricing Works" accurately describes the
page — it explains the pricing model (tiers by acreage, cadence options) and offers the quote
tool as a secondary path.

This is a single translation key (`hero.checkPricing`) that flows to three locations
automatically: the hero secondary button, the homepage bottom CtaBand, and the Services page
bottom CtaBand. No routing changes. No component changes.

### Change 2: Phone CTA demotion

The hero previously had three equal-weight buttons: "Get My Free Quote," "See Pricing," and
the phone number. Three equally prominent CTAs dilute each other — a user whose goal is to get
a quote is forced to parse three options of equal visual weight.

Phone contact is a valid fallback for hesitant or less tech-comfortable visitors, but it is
not a primary conversion path. For an address-gated local service, the goal is to guide the
user into the quote flow so they can see their actual price. Only after seeing the price does
"Schedule Service" become meaningful.

The phone link is still visible, still functional, still uses the same `siteConfig.phone.link`
and displays `siteConfig.phone.display` — it is simply presented as a text link below the two
primary buttons, not as a third equal button.

---

## What Was Deferred and Why

| Decision | Reason deferred |
|---------|----------------|
| Remove QuoteWidgetSection from `/schedule` | Requires analytics to confirm marginal value vs. homepage/pricing instances |
| Remove QuoteWidgetSection from `/pricing` | Major page restructure; requires A/B data |
| A/B test hero primary label | "Get My Free Quote" may outperform "Check Price by Address" — analytics-gated |
| Fix Services page primary CTA destination (`/schedule` → `/#quote`) | Routing change; safe but deferred to reduce sprint scope |
| Delete `AddressCheckerSection.tsx` (dead code) | Safe cleanup deferred to a code-cleanup sprint |
| Replace ScheduleSection's guest CTA | Requires replacement content decision |

---

## Sprint Summary

**Reports produced (this sprint):** 18, 19, 20, 21, 22, 23 (in `reports/2026-07-13-hero-cta-audit/`)

**Source files modified (this sprint):**
- `client/lib/translations.ts` (1 line changed)
- `client/components/sections/HeroSection.tsx` (phone CTA restructured)

**All other files:** unchanged.

**Preceding sprint** (same session, earlier context): Reports 00–17 in
`reports/2026-07-13-customer-flow-promo-popup/` — committed as `fff153d`. Promotional popup
system (DB migration, admin UI, API, frontend component). DB migration applied to production.
Changes pushed to remote.

---

## Next Steps (for a future sprint)

1. **Monitor hero engagement** — If analytics are added (Posthog, GA4, or similar), track:
   - Hero primary vs. secondary click rate
   - Phone link click rate (should be low; high rate = visitors are still hesitant after seeing the quote)
   - Drop-off between hero impression and quote widget submission

2. **Schedule page QuoteWidget decision** — Once scroll-depth data is available, determine
   whether visitors arriving at `/schedule` are using the quote widget or bouncing. If
   usage is minimal, remove it and replace with a walkthrough-request or callback form.

3. **Services page CTA destination** — Change "Get My Free Quote" → `/schedule` to
   `/#quote` or `/pricing#quote` so label and destination are consistent. Low risk, low
   effort — can be done in any sprint.

4. **AddressCheckerSection cleanup** — The component is 466 lines and imported by zero pages.
   Delete it in a code-cleanup sprint.
