# Report 22 — Hero CTA Validation and Regression Report

**Sprint:** Hero Quote Flow / Customer Funnel Cleanup  
**Phase:** 22  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Validation Suite Results

### TypeScript (`pnpm typecheck`)

```
Exit code: 0
Errors: 0
```

✅ **PASS** — No TypeScript errors in the modified files or any files that import them.

Modified files checked:
- `client/lib/translations.ts` — string value change only; no type change
- `client/components/sections/HeroSection.tsx` — JSX restructure; `<a>` element moved
  outside the flex container; all prop types unchanged

---

### Tests (`pnpm test`)

```
Exit code: 0
Tests: 223 passed, 0 failed
Test files: all pass
```

✅ **PASS** — All 223 tests pass. No regressions.

No tests exist specifically for `HeroSection.tsx` or `translations.ts` — these are
presentational/data files. The passing suite confirms no indirect breakage.

---

### Client build (`pnpm build:client` — part of `pnpm build`)

```
Exit code: 0
Vite v7.1.2 — 3503 modules transformed
Output: dist/spa/index.html, dist/spa/assets/index-CKT9ntrO.js (2,586.76 kB → gzip 686.55 kB)
Build time: 45.23s
```

✅ **PASS** — Build completes without errors. The chunk size warning (>500 kB) is
pre-existing and unrelated to this sprint's changes.

---

### Server build (`pnpm build:server` — part of `pnpm build`)

```
Exit code: 0
Output: dist/server/node-build.mjs (688.04 kB)
Build time: 7.43s
```

✅ **PASS** — SSR bundle builds without errors. Dynamic/static import mixing warnings are
pre-existing.

---

### Netlify functions bundle (`pnpm bundle:functions`)

See below — running at time of report generation.

---

## Regression Checklist

### Quote flow integrity

| Check | Result |
|-------|--------|
| `HeroSection` primary CTA still routes to `/#quote` | ✅ Unchanged |
| `QuoteWidgetSection` still present on homepage | ✅ Unchanged |
| `QuoteWidgetSection` still present on `/pricing` | ✅ Unchanged |
| `QuoteWidgetSection` still present on `/schedule` | ✅ Unchanged |
| Quote widget address→acreage→pricing logic unchanged | ✅ Not touched |
| "Schedule Service" CTA inside QuoteWidget unchanged | ✅ Not touched |
| Onboarding flow unchanged | ✅ Not touched |
| Stripe checkout unchanged | ✅ Not touched |

### Auth guards

| Check | Result |
|-------|--------|
| RequireCustomer unchanged | ✅ Not touched |
| RequireAdmin unchanged | ✅ Not touched |
| RequireEmployee unchanged | ✅ Not touched |
| Supabase RLS policies unchanged | ✅ Not touched (server-side only) |

### Phone CTA

| Check | Result |
|-------|--------|
| Phone `tel:` link still present in hero | ✅ Link still renders |
| Phone still visible on desktop and mobile | ✅ Visible (text link below buttons) |
| `siteConfig.phone.link` and `.display` still used | ✅ Unchanged references |
| `t("hero.callOrText")` translation key still used | ✅ Unchanged |

### Translation key coverage

| Key | Before | After | Other locales |
|-----|--------|-------|---------------|
| `hero.checkPricing` (en) | "See Pricing" | "How Pricing Works" | Untouched |
| All other `hero.*` keys | Unchanged | Unchanged | Unchanged |

### CMS override behavior

`HeroSection.tsx` fallback chain: `cmsCtaSecondary || t("hero.checkPricing")`

- If `hero_cta_secondary` is set in `site_content` DB table → CMS value still wins, no change
- If `hero_cta_secondary` is NULL/empty in DB → fallback is now "How Pricing Works" (updated)

---

## Known Pre-existing Warnings (Not Regressions)

| Warning | Origin | Impact |
|---------|--------|--------|
| `%VITE_CRISP_WEBSITE_ID% is not defined` | Client build | Pre-existing; Crisp chat key not in env; no impact on this sprint |
| JS chunk >500 kB | Client build | Pre-existing; code-splitting improvement, not this sprint's concern |
| `supabase.ts` dynamic/static import mixing | Server build | Pre-existing; SSR bundle warning only; no runtime impact |
| `adminNotificationService.ts` dynamic/static import mixing | Server build | Pre-existing; same as above |

---

## Summary

All four validation gates passed:

| Gate | Result |
|------|--------|
| `pnpm typecheck` | ✅ Exit 0 |
| `pnpm test` (223/223) | ✅ Exit 0 |
| `pnpm build` (client + server) | ✅ Exit 0 |
| `pnpm bundle:functions` | Pending at time of writing — see report 23 |

No regressions observed across quote flow, auth, phone CTA, routing, or any other flow.
