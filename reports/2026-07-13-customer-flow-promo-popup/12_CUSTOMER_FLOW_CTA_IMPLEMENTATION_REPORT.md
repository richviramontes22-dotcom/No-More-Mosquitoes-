# Report 12 — Customer Flow CTA Implementation

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 12  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Objective

Fix the hero section phone number to use `siteConfig.phone` as the single source of truth,
replacing the hardcoded value in the translation string.

---

## Audit Findings (from Report 03)

The hero already had correct CTA structure:
- Primary: "Get My Free Quote" → `/#quote` (smooth-scroll to QuoteWidgetSection) ✓
- Secondary: "See Pricing" → `/pricing` ✓
- Phone: `{t("hero.callOrText")}` — was `"Call or Text (949) 297-6225"` (hardcoded in translation)

No CTA rerouting or addition was needed. The only fix was decoupling the phone number from
the translation string.

---

## Changes Made

### `client/lib/translations.ts`

```diff
- callOrText: "Call or Text (949) 297-6225",
+ callOrText: "Call or Text",
```

The phone number is no longer embedded in the translation string.

### `client/components/sections/HeroSection.tsx`

```diff
- {t("hero.callOrText")}
+ {t("hero.callOrText")} {siteConfig.phone.display}
```

`siteConfig` was already imported in this file (used for the phone `href` link). The phone
number is now sourced exclusively from `client/data/site.ts`:

```ts
// client/data/site.ts
phone: {
  display: "(949) 297-6225",
  link: "tel:+19492976225",
}
```

---

## Result

The hero phone button now renders: **"Call or Text (949) 297-6225"** — visually identical
to before, but the number is now a single source of truth. Changing `siteConfig.phone.display`
automatically updates the hero button, footer, and all other `siteConfig.phone` consumers.

---

## Other CTAs Audited (No Changes Needed)

| CTA | Location | Destination | Status |
|-----|----------|-------------|--------|
| Get My Free Quote (hero primary) | HeroSection | `/#quote` | ✓ Correct |
| See Pricing (hero secondary) | HeroSection | `/pricing` | ✓ Correct |
| Call or Text (hero phone) | HeroSection | `tel:+19492976225` | ✓ Fixed |
| Get Instant Quote (AddressChecker) | AddressCheckerSection | Inline quote flow | ✓ No change |
| Schedule Service (QuoteWidget) | QuoteWidgetSection | Auth-gated (customer → modal, staff → toast, guest → signup) | ✓ Existing behavior |
| Dashboard CTAs | Dashboard pages | Internal routes | ✓ Not in scope |
