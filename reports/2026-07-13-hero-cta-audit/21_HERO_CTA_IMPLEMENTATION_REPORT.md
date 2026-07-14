# Report 21 — Hero CTA Implementation Report

**Sprint:** Hero Quote Flow / Customer Funnel Cleanup  
**Phase:** 21  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Changes Implemented This Sprint

Two low-risk changes were applied to the public hero/CTA area. No routing changes.
No component additions or removals.

---

### Change 1: Translation rename — "See Pricing" → "How Pricing Works"

**File:** `client/lib/translations.ts`  
**Key:** `hero.checkPricing` (English only)

**Before:**
```ts
checkPricing: "See Pricing",
```

**After:**
```ts
checkPricing: "How Pricing Works",
```

**Affected locations** (all use `t("hero.checkPricing")`):

| Component | Role |
|-----------|------|
| `HeroSection.tsx` hero secondary button | Hero CTA, fallback when no CMS value set |
| `Index.tsx` CtaBand (`title={t("hero.checkPricing")}`) | Homepage bottom band button |
| `Services.tsx` CtaBand (`title={t("hero.checkPricing")}`) | Services page bottom band |

**Why this change:** The old label "See Pricing" implied the destination would show an
immediate price table. The `/pricing` page opens with the embedded `QuoteWidgetSection` —
an address entry form — as the first visible element. A new visitor clicking "See Pricing"
expects to read plan rates but instead sees the same address form already visible on the
homepage. "How Pricing Works" accurately signals that the page explains the pricing model
(which it does — PlanCardsSection and FAQ follow the quote widget).

**CMS note:** `HeroSection.tsx` uses `cmsCtaSecondary || t("hero.checkPricing")`. If an
admin has set a custom value for `hero_cta_secondary` in the `site_content` table, that
CMS value still wins and the translation rename has no effect. The admin can update the CMS
value separately if desired.

---

### Change 2: Phone CTA demotion — full button → text link

**File:** `client/components/sections/HeroSection.tsx`

**Before:** Three equal-weight buttons in the hero CTA flex row:
```tsx
<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
  <Link to="/#quote" className="... bg-primary ...">
    {heroCta} <ArrowRight />
  </Link>
  <Link to="/pricing" className="... bg-secondary ...">
    {heroCtaSecondary} <ArrowRight />
  </Link>
  <a href={siteConfig.phone.link} className="... border border-primary/40 bg-primary/80 px-6 py-3.5 ...">
    <Phone /> {t("hero.callOrText")} {siteConfig.phone.display}
  </a>
</div>
```

**After:** Two primary buttons, phone as a text link below:
```tsx
<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
  <Link to="/#quote" className="... bg-primary ...">
    {heroCta} <ArrowRight />
  </Link>
  <Link to="/pricing" className="... bg-secondary ...">
    {heroCtaSecondary} <ArrowRight />
  </Link>
</div>
<a href={siteConfig.phone.link}
  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition ...">
  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
  {t("hero.callOrText")} {siteConfig.phone.display}
</a>
```

**Final hero button hierarchy:**
```
[PRIMARY]   Get My Free Quote      →  /#quote       bg-primary, full weight
[SECONDARY] How Pricing Works      →  /pricing      bg-secondary, full weight
            📞 Call or Text (949) 297-6225           text link, text-white/80, below buttons
```

**Why this change:** Phone contact is a valid fallback for hesitant visitors but is not a
primary conversion path. At equal button weight, it competed visually with the quote CTA —
the highest-value conversion action for an address-gated product. The phone link is still
visible, still functional, and still present; it is simply not at button weight. This
reinforces the hierarchy: quote → pricing education → human fallback, not three equally
urgent options.

**Mobile behavior:** On mobile all three previously stacked full-width (all 3 full-width
`<a>` and `<Link>` elements). After the change, the phone appears as a compact inline text
link rather than a full-width block, reducing visual competition.

---

## Files Modified

| File | Change Type |
|------|-------------|
| `client/lib/translations.ts` | Translation value edit (English only) |
| `client/components/sections/HeroSection.tsx` | Structural change to phone CTA placement + styling |

## Files Unchanged

| File | Reason untouched |
|------|-----------------|
| All other translation locales (es, fr, zh, etc.) | Only English value changed; other locales are untouched |
| `client/pages/Pricing.tsx` | No change needed; label rename flows through the translation key |
| `client/pages/Index.tsx` | No change needed; CtaBand uses `t("hero.checkPricing")` — rename is automatic |
| `client/pages/Services.tsx` | No change needed; CtaBand uses `t("hero.checkPricing")` — rename is automatic |
| `client/data/siteConfig.ts` | Phone number/link unchanged |
| All routing files | No routing changes made |
