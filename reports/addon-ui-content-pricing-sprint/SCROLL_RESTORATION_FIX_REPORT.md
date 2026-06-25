# Scroll Restoration Fix Report (Task 3)

**Date:** 2026-06-13
**Status:** Implemented, typechecked, and built successfully.

---

## Problem

This is a React Router v6 SPA. By default, React Router does **not** reset scroll
position on navigation — when a user clicks an internal link (e.g., header nav,
hamburger menu, footer links, CTA buttons) while scrolled down on the current page, the
new page renders at the *same scroll offset*, often landing the user mid-page instead
of at the top.

---

## Fix

**New file:** `client/components/common/ScrollToTop.tsx`

A small router-aware component that runs on every `pathname`/`hash` change:

```tsx
export const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    const id = hash.slice(1);
    let attempts = 0;
    let frame: number;

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        frame = requestAnimationFrame(tryScroll);
      } else {
        window.scrollTo(0, 0);
      }
    };

    frame = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
};
```

**Behavior:**
- **No hash** (e.g., `/`, `/pricing`, `/our-story`): scrolls to `(0, 0)` — top of page —
  on every route change.
- **With a hash** (e.g., `/our-story#team`, `/#quote`): scrolls the target element into
  view via `scrollIntoView({ behavior: "smooth", block: "start" })`. Retries up to 20
  animation frames (~300ms at 60fps) since the target element may not exist yet on the
  first paint of a freshly-mounted SPA page — if it never appears, falls back to
  scrolling to top.

**Mounted in:** `client/App.tsx`, directly inside `<BrowserRouter>` and before all
providers/routes:
```tsx
<BrowserRouter>
  <ScrollToTop />
  <AuthProvider>
    ...
```
Placing it here means it re-runs on **every** route change across the whole app
(public pages, dashboard, admin, employee portal) without needing to be added to each
page individually.

---

## Why this approach

- **No new dependencies** — pure `react-router-dom` hooks + native
  `window.scrollTo`/`Element.scrollIntoView`.
- **Doesn't break existing hash-link behavior** — pages that rely on in-page anchors
  (`/our-story#team`, `/our-story#values`, `/#quote`, `/schedule#schedule-form`, etc.)
  continue to scroll to those sections; only the *absence* of a hash now reliably resets
  to top.
- **Minimal footprint** — one new ~35-line component, one import + one mount line in
  `App.tsx`. No changes to routing config, page components, or layouts.

---

## Validation Performed

- `npm run typecheck` — ✅ passes
- `npm run build` — ✅ succeeds
- `npm test` — ✅ 16/16 pass
- Code review confirms:
  - `ScrollToTop` is mounted once, at the top of the router tree (`client/App.tsx:125`)
  - It is the **only** scroll-management code added — no conflicting
    `scrollRestoration` config or duplicate listeners found elsewhere in `App.tsx` or
    `MainLayout.tsx`/`DashboardLayout.tsx`/`CheckoutLayout.tsx`

---

## Manual Browser Checklist (not yet performed — no browser tool available)

1. From `/our-story`, scroll to the bottom, then click a header nav link to `/pricing`
   → page should load scrolled to top.
2. From any page, click a footer link (e.g., "FAQ") while scrolled down → `/faq` loads
   at top.
3. Open the hamburger menu (mobile width) while scrolled down on `/services`, click
   "Home" → `/` loads at top, menu closes.
4. From `/`, click a CTA that links to `/our-story#team` → `/our-story` loads and
   smooth-scrolls to the Team section.
5. From `/our-story#team`, click a link to `/our-story#values` (same page, different
   hash) → page smooth-scrolls to the Values section (confirms the effect re-runs on
   hash-only changes, since `pathname` is unchanged but `hash` is in the dependency
   array).
6. From `/`, click "Get a Quote" / `#quote` anchor → smooth-scrolls to the quote widget
   on the same page.
7. Browser back/forward buttons after the above — confirm no jarring double-scroll or
   stuck position (React Router's `popstate` handling triggers the same `useLocation`
   change, so this should behave the same as forward navigation).
