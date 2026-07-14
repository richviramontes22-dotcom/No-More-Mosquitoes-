# Report 16 — Sprint Final Report: Customer Flow Cleanup + Promo Popup System

**Sprint:** Customer-Facing Flow Cleanup + Promo Popup System  
**Phase:** 16 (Final)  
**Date:** 2026-07-13  
**Status:** COMPLETE — READY FOR REVIEW AND DEPLOY

---

## Sprint Summary

This sprint delivered four distinct improvements to the No More Mosquitoes customer experience
and admin tooling, all on top of the baseline commit `1e23448`.

---

## Deliverable 1: Appointment Slot Privacy

**Goal:** Hide capacity/count data from unauthenticated callers; hide unavailable windows.

**Shipped:**
- `GET /api/availability` no longer returns `capacity`, `booked`, or `remaining`. The response
  is `{ id, label, start, end, available: boolean }` — enough to display the slot, nothing more.
- Both customer scheduling UIs (`ScheduleFlow.tsx`, `Appointments.tsx`) now hide unavailable
  windows entirely (`.filter(w => w.available)`) instead of showing them greyed out.
- Slot labels changed from "X spots left" to "Available".
- Capacity enforcement is fully intact server-side.

---

## Deliverable 2: Language Selector Removal

**Goal:** Remove the custom language/translation picker UI; preserve infrastructure.

**Shipped:**
- Desktop and mobile language selector blocks removed from `SiteHeader.tsx`.
- `useLanguage`, flag icon imports, and `ChevronDown` (now unused) removed from the header.
- `LanguageContext`, `translations.ts`, and `useTranslation()` untouched — all `t()` call sites
  continue to compile. English is always returned.

---

## Deliverable 3: Promotional Popup System

**Goal:** Admin-managed, customer-facing promotional popups with audience targeting, scheduling,
and dismissal logic.

**Shipped:**
- **DB:** `promotional_popups` table with RLS (public reads only active/current rows).
  Migration: `db/migrations/2026-07-13_create_promotional_popups.sql` — **needs manual apply**.
- **API:** Full CRUD at `/api/admin/promotional-popups` (admin-protected) + public
  `GET /api/promotional-popups/active?path=` (anon, RLS-filtered).
- **Admin UI:** `/admin/promotions` page — stats, table, create/edit Dialog, preview Dialog,
  activate/deactivate toggle. Accessible from admin nav: Content → Promotions.
- **Customer display:** `PromotionalPopup.tsx` mounted in `MainLayout` — audience-filtered,
  frequency-controlled dismissal, 800ms delay, blocked on sensitive paths, fully accessible.

---

## Deliverable 4: Hero CTA Phone Number Fix

**Goal:** Source the hero phone number from `siteConfig.phone` instead of a hardcoded
translation string.

**Shipped:**
- `translations.ts`: `callOrText` changed from `"Call or Text (949) 297-6225"` → `"Call or Text"`.
- `HeroSection.tsx`: renders `{t("hero.callOrText")} {siteConfig.phone.display}`.
- Changing `siteConfig.phone.display` now updates the hero button, footer, and all consumers.

---

## Validation

| Gate | Result |
|------|--------|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm test` | ✅ 223/223 |
| `pnpm build` | ✅ Clean |
| `pnpm bundle:functions` | ✅ 7/7 |

---

## Pre-Deploy Checklist

- [ ] **Apply DB migration** `db/migrations/2026-07-13_create_promotional_popups.sql` in
  Supabase SQL Editor
- [ ] **Live browser QA:** appointment slot grid, popup display, header cleanup
- [ ] **User approves push** (push_automatically: false per sprint config)
- [ ] **User approves deploy** (require_user_approval_before_deploy: true)

---

## Carry-Forward Items

See Report 17 for full launch-blocker status. No new blockers introduced by this sprint.
The two blockers from the launch-signoff sprint (RLS isolation test + Netlify env verification)
remain open and are not affected by these changes.
