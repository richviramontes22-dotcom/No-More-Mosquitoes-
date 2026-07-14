# Phase 03 — Hero CTA Audit and Recommendation

**Date:** 2026-07-13  
**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System

---

## Current Hero Buttons

File: `client/components/sections/HeroSection.tsx`

| Button | Label (English default) | Route | Notes |
|---|---|---|---|
| Primary | "Get My Free Quote" | `Link to="/#quote"` | Scrolls to QuoteWidgetSection |
| Secondary | "See Pricing" | `Link to="/pricing"` | Static pricing page |
| Phone | "Call or Text (949) 297-6225" | `href={siteConfig.phone.link}` | Tel: link |

All three labels are CMS-overridable via the `site_content` DB table (`hero_cta_text`, `hero_cta_secondary`). The phone CTA label is hardcoded in the `hero.callOrText` translation string.

---

## Audit Questions

### Does "Schedule Service" duplicate "Check Price by Address"?

**No.** The current primary button already says "Get My Free Quote" (not "Schedule Service") and routes to `/#quote` which scrolls to the QuoteWidgetSection — the address + acreage + pricing widget. This IS the correct primary conversion path. The label accurately describes the action.

The sprint spec mentioned "Schedule Service" as a hero button — that label exists in the mobile nav drawer and some secondary pages but NOT as the primary hero button text. The hero primary is already "Get My Free Quote."

### Does "Schedule Service" skip pricing/quote logic?

**N/A.** Hero primary is "Get My Free Quote" → `/#quote`. The flow correctly enters the quote widget first.

### Does "Check Price by Address" represent the true primary conversion path?

**Yes — and it already IS the hero primary.** "Get My Free Quote" → `/#quote` → QuoteWidgetSection → address lookup → acreage → pricing → plan selection → schedule. This is the correct funnel.

### Does phone CTA belong in hero?

**Minor issue.** The phone CTA is a third co-equal button which slightly dilutes the primary CTA's visual priority. However, for a service business, call/text access is high-value and removing it from the hero would hide it. Recommendation: keep it but fix the implementation detail (see below).

### Is the phone number hardcoded?

**Yes, in `translations.ts`:** `hero.callOrText: "Call or Text (949) 297-6225"` — the number is embedded in the translation string. If the number changes, this string won't auto-update from `siteConfig.phone`. Fix: update `hero.callOrText` to just "Call or Text" and render `siteConfig.phone.display` separately in the component.

### Does hero CTA behavior match other pages?

**Yes.** `/pricing` and `/schedule` both include the QuoteWidgetSection. CtaBand on all pages routes to `/schedule` which also shows the widget. The funnel is consistent.

---

## Recommendations

| Button | Current State | Recommendation | Action |
|---|---|---|---|
| Primary: "Get My Free Quote" → `/#quote` | ✅ Correct | Keep as-is | No change |
| Secondary: "See Pricing" → `/pricing` | ✅ Correct | Keep as-is | No change |
| Phone: "Call or Text (949) 297-6225" | ⚠️ Phone number hardcoded in translation | Fix source | Update translation + component (Phase 12) |

### Summary

Hero CTA structure is already well-optimized:
- Primary correctly leads to the address/quote widget
- Secondary correctly goes to the static pricing page for browsers
- Phone CTA provides direct contact access

**No structural hero CTA changes needed.** Only one minor fix: decouple the phone number from the translation string.

---

## Phase 12 Action

Change `translations.ts` `hero.callOrText` from `"Call or Text (949) 297-6225"` to `"Call or Text"`.

Update `HeroSection.tsx` phone button to render:
```tsx
{t("hero.callOrText")} {siteConfig.phone.display}
```

This ensures `siteConfig.phone.display` stays the single source of truth for the displayed phone number.
