# Report 07 — Translation Feature Removal Implementation

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 7  
**Date:** 2026-07-13  
**Status:** COMPLETE

---

## Objective

Remove the custom language/translation selector UI from the site header while preserving the
infrastructure (`LanguageContext`, `translations.ts`, `useTranslation()`), so all `t()` call
sites continue to compile and English is always served.

---

## Changes Made

### `client/components/layout/SiteHeader.tsx`

**Removed imports:**
```tsx
import { useLanguage } from "@/contexts/LanguageContext";
import { FlagUS, FlagMX, FlagJP, FlagCN } from "@/components/common/FlagIcon";
```

**Removed hook call:**
```tsx
const { language, setLanguage } = useLanguage();
```

**Removed desktop language selector block** (was ~lines 392–424):
```tsx
<div className="hidden md:block">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="gap-1.5 ...">
        {language === "en" && <FlagUS ... />}
        ...
        <ChevronDown ... />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => setLanguage("en")}>English</DropdownMenuItem>
      ...
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

**Removed mobile language selector block** (was ~lines 438–469): same DropdownMenu pattern
inside the mobile drawer.

**Cleaned up unused import:** `ChevronDown` was only used by the language selector; removed from
the lucide-react import line.

### `client/lib/translations.ts`

Changed `hero.callOrText` from a hardcoded phone string to a label only:

```diff
- callOrText: "Call or Text (949) 297-6225",
+ callOrText: "Call or Text",
```

The phone number is now sourced from `siteConfig.phone.display` at the call site (see Report 12).

---

## Infrastructure Preserved

| Item | Status |
|------|--------|
| `client/contexts/LanguageContext.tsx` | Unchanged — still exports `LanguageProvider`, `useLanguage` |
| `client/lib/translations.ts` | Unchanged structurally — `t()` hook still functional |
| `client/hooks/useTranslation.ts` | Unchanged |
| `LanguageProvider` in `App.tsx` | Unchanged — still wraps the app |

The language is effectively locked to English (`"en"`) because users have no way to change it,
but the system remains functional if a language picker is re-added in the future.

---

## Verification

- `pnpm typecheck` — 0 errors (no `useLanguage` / `setLanguage` / flag icon references remain
  in compiled output)
- `pnpm test` — 223/223 passing
- `pnpm build` — clean
