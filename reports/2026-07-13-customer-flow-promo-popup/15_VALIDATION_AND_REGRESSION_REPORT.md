# Report 15 — Validation and Regression Report

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 15  
**Date:** 2026-07-13  
**Status:** COMPLETE — ALL GATES PASSED

---

## Validation Results

### TypeScript Typecheck

```
pnpm typecheck  →  exit 0  (0 errors)
```

Three errors fixed before this run:

| Error | File | Fix |
|-------|------|-----|
| `Property 'profile' does not exist on type 'UseQueryResult<Profile, Error>'` | `PromotionalPopup.tsx:54` | Changed `const { profile }` → `const { data: profile }` |
| `'capacity' does not exist in type 'SetStateAction<WindowAvailability>'` | `ScheduleFlow.tsx:~230` | Removed `capacity: 0, booked: 0, remaining: 0` from `setSelectedWindow` restore call |
| `Property 'icon' does not exist on type 'IntrinsicAttributes & SectionHeadingProps'` | `PromotionsManagement.tsx:187` | Replaced `<SectionHeading icon={...}>` with inline heading div; removed unused `SectionHeading` import |

### Test Suite

```
pnpm test  →  exit 0
26 test files, 223 tests — all passed
```

No tests added or modified in this sprint (all changes are UI/API additions; existing test
coverage for `leadService`, `billingStripe`, and `requireRole` specs verified no regressions).

### Production Build

```
pnpm build  →  exit 0
  build:client  3503 modules transformed  ✓
  build:server  108 modules transformed   ✓
```

Warnings (pre-existing, not introduced by this sprint):
- `%VITE_CRISP_WEBSITE_ID%` not defined in env — pre-existing
- Chunk size warning (2.5 MB unminified) — pre-existing, not related to sprint changes
- Dynamic/static import mixing warnings — pre-existing

### Netlify Functions Bundle

```
pnpm bundle:functions  →  exit 0
7/7 functions bundled:
  api, auto-publish-routes, expire-annual-plans, generate-appointments,
  send-annual-warnings, send-reminders-2h, send-reminders
```

`api.cjs` includes the new `adminPromotionalPopups` router (confirmed by `server/index.ts` mount
and the bundle passing without error).

---

## Files Changed (Sprint Summary)

### Modified
- `server/routes/availability.ts` — strip capacity/booked/remaining from response
- `server/index.ts` — mount `adminPromotionalPopupsRouter`
- `client/components/schedule/ScheduleFlow.tsx` — slot privacy + TypeScript fix
- `client/pages/dashboard/Appointments.tsx` — slot privacy
- `client/components/layout/SiteHeader.tsx` — remove language selector UI
- `client/components/layout/MainLayout.tsx` — mount PromotionalPopup
- `client/lib/translations.ts` — remove hardcoded phone from callOrText string
- `client/components/sections/HeroSection.tsx` — use siteConfig.phone.display
- `client/pages/admin/PromotionsManagement.tsx` — TypeScript fix (heading)
- `client/components/promotions/PromotionalPopup.tsx` — TypeScript fix (useProfile)

### Created
- `db/migrations/2026-07-13_create_promotional_popups.sql`
- `server/routes/adminPromotionalPopups.ts`
- `client/components/promotions/PromotionalPopup.tsx`
- `client/pages/admin/PromotionsManagement.tsx`

### Reports Written
- Reports 00–15, 16, 17 in `reports/2026-07-13-customer-flow-promo-popup/`

---

## Pending Manual Steps

1. **Apply DB migration** — `db/migrations/2026-07-13_create_promotional_popups.sql` in Supabase
   SQL Editor. Not applied yet (no access to production DB in this session).
2. **Live browser QA** — appointment slot grid, popup display, header language selector removal.
3. **Push + deploy** — pending explicit user authorization.
