# Add-on Sprint — Validation Report

**Date:** 2026-06-13
**Scope:** Validation of Tasks 1-6 (UI/content fixes) and Task 3 (scroll restoration).
Task 7 (pricing/cadence) was an investigation-only deliverable — see
`PLAN_PRICING_CADENCE_AUDIT.md` / `PLAN_PRICING_CADENCE_FIX_PROPOSAL.md`; no code was
changed for Task 7.

---

## 1. Automated Checks

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | ✅ Pass — no errors |
| Production build (client) | `npm run build:client` (via `npm run build`) | ✅ Pass — `dist/spa/` built in 23.82s. Pre-existing warnings only: `%VITE_CRISP_WEBSITE_ID%` undefined in `index.html`, chunk-size warning on `index-*.js` (2.28 MB), `caniuse-lite` data 10 months old. None introduced by this sprint. |
| Production build (server) | `npm run build:server` (via `npm run build`) | ✅ Pass — `dist/server/node-build.mjs` built in 2.04s. Pre-existing dynamic/static-import-mix warnings for `server/lib/supabase.ts` and notification services — unrelated to this sprint's changes. |
| Test suite | `npm test` (`vitest --run`) | ✅ Pass — 3 test files, 16/16 tests passed (`server/services/parcel/googleAddressService.spec.ts`, `client/lib/utils.spec.ts`, `client/lib/pricing.spec.ts`). No test touches footer/story/team/scroll code; none of this sprint's changes are covered by automated tests. |

---

## 2. Code-Level Change Verification (via `git diff`)

Every file touched by Tasks 1-6 was re-read against `git diff` to confirm the change
present matches the task description:

| Task | File(s) | Verified change |
|---|---|---|
| 1 — Footer images horizontal | `client/components/layout/SiteFooter.tsx` | Two separate rows (circular seals `h-48/h-64` + banner logos `h-24/h-32`) merged into one `flex flex-wrap` row at reduced sizes (`h-20/h-24` seals, `h-14/h-16` banners); container gap `gap-10`→`gap-6`. ✅ |
| 2 — Remove footer guarantee text | `client/components/layout/SiteFooter.tsx` | `<p><span>{t("footer.attributes")}</span></p>` ("Insured • 100% satisfaction guarantee.") removed from JSX. Translation key left unused but harmless. ✅ |
| 4 — Mission "expect"→"demand" | `client/lib/translations.ts` (en `pages.story.content`) | "...designed for those who **expect**..." → "...who **demand**..." ✅ |
| 5 — Reorder team cards | `client/data/team.ts` | `leadershipTeam` reordered to Richard, Elijah, Brianna, Sandy, Christina, Bobby. Renders (via `TeamGrid.tsx`, `lg:grid-cols-3`) as Row 1: Richard/Elijah/Brianna, Row 2: Sandy/Christina/Bobby. ✅ |
| 6 — Story paragraph copy | `client/lib/translations.ts` (en `pages.story.content`), `client/data/site.ts` (`storyMarkdown`) | "Laughter turned to slaps as we armed ourselves..." → "Laughter turned into slaps, we armed ourselves..." — updated in **both** duplicate copies of the story text. ✅ |
| 3 — Scroll restoration | `client/components/common/ScrollToTop.tsx` (new), `client/App.tsx` | New component scrolls to top on route change (no hash) or smooth-scrolls to hash target (with retry). Mounted at `<BrowserRouter><ScrollToTop />...` so it applies app-wide. ✅ |

No other unrelated files were modified by this sprint's Tasks 1-6/3 work. (Other
modified files visible in `git status` — `client/App.tsx` aside — belong to the prior
Google Maps Geocoding/Places sprint and were not touched in this sprint, per the "do not
revisit Google setup" constraint.)

---

## 3. Manual / Browser Verification — NOT PERFORMED

**No browser automation tool (e.g., Playwright/Puppeteer MCP) was available in this
environment**, and the sandboxed shell could not reliably launch and probe a dev server
for visual confirmation. All Task 1-6/3 changes were therefore verified at the
**code/diff level only** (section 2 above), backed by passing typecheck/build/tests.

This is **sufficient to confirm the changes are syntactically correct, type-safe, and
don't break the build or existing tests** — but it does **not** confirm pixel-level
visual correctness (e.g., whether the footer row actually wraps nicely at every
breakpoint, or whether the smooth-scroll-to-hash timing feels right in practice).

### Recommended manual QA pass (5-10 min, before/after deploy)

1. **Footer (Task 1 & 2)** — visit any page, scroll to footer:
   - Desktop: confirm all 4 compliance images (2 circular seals + 2 banner logos) sit
     in a single horizontal row.
   - Mobile width (~375px): confirm the row wraps gracefully (2+2 or similar) without
     overflow/clipping.
   - Confirm the "Insured • 100% satisfaction guarantee." line is gone from directly
     below the seals/banners.
   - Confirm the separate "Licensed • Insured • 100% Satisfaction Guarantee •
     Employee/Community Based Company" trust line **above** the compliance section is
     still present (intentionally not removed — see `ADDON_UI_CONTENT_FIX_REPORT.md`
     Task 2 note).

2. **Scroll restoration (Task 3)**:
   - Scroll down on `/our-story`, click a header nav link to `/pricing` → loads at top.
   - Click a footer link while scrolled down → target page loads at top.
   - Open hamburger menu (mobile width) while scrolled down, navigate → target page
     loads at top, menu closes.
   - Click a CTA/link with a hash (`/our-story#team`, `/#quote`,
     `/schedule#schedule-form`) → page loads and smooth-scrolls to that section.
   - From `/our-story#team`, click to `/our-story#values` → smooth-scrolls to the new
     section (same-page hash change).

3. **Mission statement (Task 4)** — visit `/our-story`, confirm the mission paragraph
   reads "...designed for those who **demand** the highest standard of outdoor
   comfort."

4. **Team order (Task 5)** — visit `/our-story#team`:
   - Desktop (≥1024px, 3-col grid): Row 1 = Richard, Elijah, Brianna; Row 2 = Sandy,
     Christina, Bobby.
   - Tablet (2-col): Richard/Elijah, Brianna/Sandy, Christina/Bobby.
   - Mobile (1-col): Richard, Elijah, Brianna, Sandy, Christina, Bobby in that vertical
     order.

5. **Story paragraph (Task 6)** — on `/our-story`, confirm the "How One Backyard
   Evening..." paragraph reads "...Laughter turned into slaps, we armed ourselves with
   sprays..." (not "Laughter turned to slaps as we armed ourselves...").

---

## 4. Out of Scope / Not Validated

- **Task 7 (pricing/cadence)** — investigation only, no code changed, nothing to
  validate. See `PLAN_PRICING_CADENCE_AUDIT.md` and
  `PLAN_PRICING_CADENCE_FIX_PROPOSAL.md`.
- **Google Maps / Geocoding / Places (prior sprint)** — explicitly out of scope per this
  sprint's instructions ("do not revisit Google setup unless the current task touches
  quote/pricing form behavior"). Not re-validated here.

---

## Summary

All automated checks pass (typecheck, build, tests). All six content/layout changes
(Tasks 1, 2, 3, 4, 5, 6) were verified present and correctly scoped via direct diff
inspection. No unrelated files were modified. Manual browser verification is
recommended using the checklist above before considering this sprint fully closed, as
no browser automation was available to perform it during this session.
