# Phase 06 — Translation Feature Removal Audit

**Date:** 2026-07-13  
**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System

---

## Current Translation System

A full custom i18n system is implemented. It is NOT Google Translate / browser translate — it is a bespoke React i18n layer with manual translations.

### Core Files

| File | Lines | Role |
|---|---|---|
| `client/lib/translations.ts` | ~2,355 | Full translation dictionary: `en`, `es`, `jp`, `cn` keys |
| `client/contexts/LanguageContext.tsx` | ~40 | React context: `Language = "en" \| "es" \| "jp" \| "cn"`; persists to `localStorage` |
| `client/hooks/use-translation.ts` | ~30 | `useTranslation()` hook: resolves dot-path keys against active language |
| `client/components/common/FlagIcon.tsx` | ~100 | Inline SVG flags: `FlagUS`, `FlagJP`, `FlagCN`; `FlagMX` loads from **external Builder.io CDN** (inconsistent) |

### UI Components

Language selector appears in two locations in `client/components/layout/SiteHeader.tsx`:

1. **Desktop header** (lines 395-424) — wrapped in `hidden md:block`:
   - Flag-icon button → `DropdownMenu` with 4 language options
   - `onClick={() => setLanguage("en"/"es"/"jp"/"cn")}`

2. **Mobile drawer** (lines 472-503) — inside `SheetContent`:
   - Full-width `Button` + `DropdownMenu` with same 4 options
   - Positioned above the main navigation links

### App Integration

- `client/App.tsx` line 155: `<LanguageProvider>` wraps the entire app
- Every component that uses translated strings imports `useTranslation()` and calls `t("key.subkey")`
- Default language is `"en"` (hardcoded in `LanguageContext.tsx`)

---

## What Is Used Everywhere (Do NOT remove)

`useTranslation()` / `t("...")` is called in:
- `SiteHeader.tsx`, `SiteFooter.tsx`, `HeroSection.tsx`
- Nearly every public-facing section component
- Customer dashboard components
- Legal/info pages

If `LanguageProvider` is removed or `useTranslation()` throws, the entire app breaks.

**Strategy: Remove the UI (language picker), keep the infrastructure.** English will always be returned since the user can never change the language.

---

## Removal Strategy

| What | Action | Why |
|---|---|---|
| Language picker (desktop, SiteHeader lines 395-424) | **Remove** | Invisible after removal; no layout impact |
| Language picker (mobile, SiteHeader lines 472-503) | **Remove** | Clears one entry from mobile sheet |
| `FlagUS`, `FlagMX`, `FlagJP`, `FlagCN` imports (SiteHeader line 11) | **Remove** | No longer referenced |
| `useLanguage` import + destructure (SiteHeader) | **Remove** | `language`/`setLanguage` no longer used |
| `ChevronDown` import (SiteHeader line 3) | **Keep** | May be used elsewhere in the header (admin alerts dropdown) |
| `LanguageProvider` in `App.tsx` | **Keep** | All `t()` calls depend on it |
| `translations.ts`, `LanguageContext.tsx`, `use-translation.ts` | **Keep** | Used throughout codebase |
| `FlagIcon.tsx` | **Keep** | Still imported and available; just not used in SiteHeader after removal |

---

## FlagMX External CDN Issue

`FlagMX` in `FlagIcon.tsx` loads the Mexican flag from `https://cdn.builder.io/...` rather than an inline SVG (unlike `FlagUS`, `FlagJP`, `FlagCN`). This creates:
- External CDN dependency
- Potential CSP issue

Since we're removing `FlagMX` from `SiteHeader`, this is no longer a problem in practice. The component file itself is left in place (not removing files unless unused by all callers).

---

## Impact on Browser Native Translation

- The `<html lang="en">` attribute is in `index.html`, not in any component being modified.
- No `translate="no"` attributes are being added or removed.
- Browser/device native translation (Google Chrome translate, iOS translate, etc.) works on text content regardless of the custom i18n system.
- Removing the language picker does NOT affect browser native translation.

---

## Build Impact

After removing the language picker from SiteHeader:
- `FlagUS`, `FlagMX`, `FlagJP`, `FlagCN` may become unused imports if `FlagIcon.tsx` isn't used elsewhere. They remain importable and don't cause errors.
- No circular imports.
- TypeScript: removing `useLanguage` from SiteHeader eliminates two `language`/`setLanguage` variable usages — no errors after removal.
- `ChevronDown` from lucide remains used for the admin alerts dropdown.

---

## Verdict

Safe to remove the language picker UI. Removal confined to ~30 lines across 2 blocks in `SiteHeader.tsx`. No other files need changes. Language infrastructure stays intact.
