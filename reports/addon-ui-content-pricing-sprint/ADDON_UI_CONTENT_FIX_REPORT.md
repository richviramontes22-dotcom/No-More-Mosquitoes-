# Add-on UI/Content Sprint — Fix Report (Tasks 1, 2, 4, 5, 6)

**Date:** 2026-06-13
**Status:** Implemented, typechecked, and built successfully. Manual browser
verification still recommended (see `ADDON_VALIDATION_REPORT.md`).

This report covers the five content/layout fixes from the add-on sprint. Task 3
(scroll restoration) and Task 7 (pricing/cadence audit) are covered in their own
reports: `SCROLL_RESTORATION_FIX_REPORT.md` and `PLAN_PRICING_CADENCE_AUDIT.md` /
`PLAN_PRICING_CADENCE_FIX_PROPOSAL.md`.

---

## Task 1 — Footer seals/banners: merge into one horizontal row

**File:** `client/components/layout/SiteFooter.tsx`

**Before:** the "Licensed & Regulated" compliance block rendered two separate rows:
- Row 1: two large circular seals (Anaheim Business License, State of CA seal) at
  `h-48 w-48` (mobile) / `h-64 w-64` (desktop)
- Row 2: two horizontal banner logos (CA DPR, State of CA bear) at `h-24` (mobile) /
  `h-32` (desktop)

**After:** all four images are now in a **single** `flex flex-wrap` row
(`flex flex-wrap items-center justify-center gap-8 sm:gap-12`), with sizes reduced so
they sit comfortably inline:
- Circular seals: `h-20 w-20` (mobile) / `h-24 sm:h-24` (desktop) — down from
  `h-48`/`h-64`
- Banner logos: `h-14` (mobile) / `h-16` (desktop) — down from `h-24`/`h-32`

The outer container's gap was reduced from `gap-10` to `gap-6` to tighten the spacing
now that there's only one row instead of two.

On narrow viewports, `flex-wrap` allows the row to wrap to two lines while remaining
horizontally laid out (not stacked full-width), satisfying "horizontally inline on
desktop" while staying usable on mobile.

---

## Task 2 — Remove footer guarantee text

**Files:** `client/components/layout/SiteFooter.tsx`

Removed the paragraph rendering the `footer.attributes` translation key:
```tsx
<p className="flex flex-wrap gap-3">
  <span>{t("footer.attributes")}</span>
</p>
```
which displayed **"Insured • 100% satisfaction guarantee."** directly below the
Licensed & Regulated / compliance-seals block.

**Note:** the `footer.attributes` translation key itself (`client/lib/translations.ts`,
all 4 locales) was left in place but is now unused by `SiteFooter.tsx` — left as-is
since removing translation keys was out of scope and the unused key has no runtime
effect (dead string, not dead code).

**Not changed (intentionally):** the separate "Trust Line" directly above the
compliance section —
`Licensed • Insured • 100% Satisfaction Guarantee • Employee/Community Based Company`
(`SiteFooter.tsx` line ~186) — was **not** touched. This is a different, pre-existing
element from the one targeted by Task 2 (`footer.attributes`). If the intent was
instead (or also) to remove this Trust Line, flag it and it can be addressed in a quick
follow-up.

---

## Task 4 — Mission statement: "expect" → "demand"

**Files:** `client/lib/translations.ts` (`pages.story.content`, English locale)

```diff
- ...designed for those who expect the highest standard of outdoor comfort.
+ ...designed for those who demand the highest standard of outdoor comfort.
```

Only the English (`en`) locale string was changed, matching the verbatim instruction
("mission statement says 'demand'"). The other locale translations (es/ja/zh) for this
same paragraph were not touched — if those should also be updated for consistency,
that's a separate localization task.

---

## Task 5 — Reorder team cards

**File:** `client/data/team.ts`

`leadershipTeam` array order changed from:
1. Richard Viramontes
2. Sandy Viramontes
3. Christina Nguyen
4. Bobby Reynoso
5. Brianna Miyake
6. Elijah Noble

to:
1. Richard Viramontes
2. Elijah Noble
3. Brianna Miyake
4. Sandy Viramontes
5. Christina Nguyen
6. Bobby Reynoso

**Rendered layout** (`client/components/page/TeamGrid.tsx:22`, grid
`md:grid-cols-2 lg:grid-cols-3`):

| | Col 1 | Col 2 | Col 3 |
|---|---|---|---|
| **Desktop (3-col)** | Richard | Elijah | Brianna |
| | Sandy | Christina | Bobby |

| | Col 1 | Col 2 |
|---|---|---|
| **Tablet (2-col)** | Richard | Elijah |
| | Brianna | Sandy |
| | Christina | Bobby |

**Mobile (1-col):** sequential — Richard, Elijah, Brianna, Sandy, Christina, Bobby.

No bio/role content was changed — only array order (and the two stale row-position
comments describing the previous arrangement were removed).

---

## Task 6 — Story paragraph copy change

**Files:** `client/lib/translations.ts` (`pages.story.content`, English locale),
`client/data/site.ts` (`storyMarkdown`)

```diff
- ...Within minutes of stepping outside, we were being eaten alive by mosquitoes.
- Laughter turned to slaps as we armed ourselves with sprays, lit candles, and tried
- every gadget we could find. Before long...
+ ...Within minutes of stepping outside, we were being eaten alive by mosquitoes.
+ Laughter turned into slaps, we armed ourselves with sprays, lit candles, and tried
+ every gadget we could find. Before long...
```

This sentence exists in **two places** that must stay in sync — `translations.ts`
(used by `StorySection`/`OurStory` via `useTranslation`) and `client/data/site.ts`'s
`storyMarkdown` constant (a duplicate/legacy copy of the same story text). Both were
updated identically so the copy is consistent regardless of which source a given page
renders from.

---

## Validation Performed

- `npm run typecheck` — ✅ passes, no errors
- `npm run build` (client + server) — ✅ succeeds (pre-existing chunk-size and
  dynamic-import warnings only, unrelated to these changes)
- `npm test` — ✅ 16/16 tests pass (3 test files, none touching footer/story/team)
- Code-level diff review of every changed file (see `ADDON_VALIDATION_REPORT.md` for
  the full diff-by-diff verification)

**Not performed:** live browser/visual verification — no browser automation tool was
available in this environment. See `ADDON_VALIDATION_REPORT.md` for a manual QA
checklist to run before/after deploy.
