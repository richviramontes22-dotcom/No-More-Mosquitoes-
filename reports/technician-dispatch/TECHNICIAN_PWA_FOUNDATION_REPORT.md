# Technician PWA Foundation Report

## What was built

No new dependency was added (no `vite-plugin-pwa`/Workbox) — a hand-rolled manifest + service worker,
written directly as static files under `public/`, gives full control with zero new build-time risk. This
project's `vite.config.ts` has already been burned once by build-tooling surprises (the documented
dynamic-import requirement to avoid hanging `vite build`); adding a plugin that hooks into the build
pipeline wasn't worth that risk for what's a fairly small, well-understood feature set.

- **`public/employee-manifest.webmanifest`** — `start_url`/`scope: "/employee"`, standalone display,
  icons from the existing `nmm-logo.png` brand asset (600×600, declared at 192/512). Not declared
  `maskable` — the logo's text wraps close to the edge and would clip under a mask; safer to ship `any`
  purpose only than claim a guarantee that isn't true.
- **`public/employee-sw.js`** — a vanilla service worker (no Workbox). Precaches the offline fallback page
  and the logo on install; on `activate`, deletes any cache from a previous `CACHE_VERSION` (safe
  invalidation). Its fetch handler explicitly does nothing for non-GET, cross-origin, or `/api/*` requests
  — those fall straight through to the network exactly as if no service worker existed. Navigation requests
  are network-first with a cache fallback, then the offline page as a last resort. Static assets are
  cache-first, **scoped specifically to `/assets/*`** (Vite's actual production build output path,
  confirmed against a real `pnpm build`) rather than "any same-origin GET" — see the dev-mode finding below
  for why that distinction mattered.
- **`public/employee-offline.html`** — a plain, dependency-free HTML page (no React, no build step) shown
  when a navigation fails and isn't cached. Has to be independent of the app bundle, since the bundle
  itself might be exactly what's unavailable.
- **`client/lib/employee/pwa.ts`** — `enableEmployeePwa()` / `disableEmployeePwa()`, called only from
  `EmployeeLayout.tsx`'s mount/unmount effect. Injects/removes the manifest `<link>` and iOS
  `apple-mobile-web-app-*` meta tags from `document.head`. The service worker itself is registered with
  `scope: "/employee"` (no trailing slash, see below) and is deliberately never unregistered on unmount —
  an installed standalone instance may still be running against that scope in another window.
- **`client/hooks/employee/useOnlineStatus.ts`** + **`client/components/employee/OfflineIndicator.tsx`** —
  a small reusable connectivity hook and the banner it drives, mounted in `EmployeeLayout.tsx` so it's
  visible across every technician page. Phase 4 will extend the same banner with a pending-sync count once
  the action queue exists.

## Scoping — verified live, not just by reading the code

Confirmed via Playwright against the running app:

| Check | Result |
|---|---|
| Public homepage (`/`) | 0 manifest `<link>` tags, 0 service worker registrations |
| `/employee` (dashboard) | Manifest injected, SW registered and active |
| `/employee/profile` (different employee route) | Manifest still present (persists across client-side nav) |

Nothing in `App.tsx`, `MainLayout`, `DashboardLayout`, or `AdminLayout` references `pwa.ts` — only
`EmployeeLayout.tsx` does. Public, customer, and admin pages are structurally incapable of triggering this
code.

## Two real bugs found and fixed while verifying this — neither obvious from reading the code alone

1. **Scope trailing-slash mismatch.** Service worker scope matching is a plain string prefix on the URL
   path. The technician dashboard's own route is the bare `/employee` (no trailing slash — see
   `EmployeeLayout`'s nav, `to: "/employee"`). Registering with scope `/employee/` (trailing slash) meant
   the *dashboard itself* — the most-visited page — was never controlled by the service worker, even though
   every other employee page (`/employee/route`, `/employee/profile`, etc., all with a path segment after
   `/employee/`) was. Caught by checking `navigator.serviceWorker.controller` directly rather than assuming
   registration success meant control. Fixed by registering with scope `/employee` (no trailing slash),
   which correctly covers all of them.
2. **Dev-mode cache pollution.** Vite's dev server serves every source module as its own unbundled URL
   (hundreds of individual `.tsx`/`.js` requests) — an initial "cache any same-origin GET that isn't
   `/api/*`" rule ended up caching 200+ files, including the source for every admin and customer page
   (`client/pages/admin/*.tsx`, `client/pages/dashboard/*.tsx`, etc., transitively imported by the same
   bundle graph). This is a dev-mode artifact, not a real production risk (production ships 1-2 hashed
   bundle files total — confirmed by an actual `pnpm build`), but it was close enough to "caching admin
   pages" to fix properly rather than wave off. Restricted the cache-first branch to exactly
   `/assets/*` (Vite's real production output path) plus the explicitly-listed precached files. Re-verified
   against the actual production build: the cache after a full session held exactly five entries — the
   offline shell, the logo, the `/employee` navigation document, and the two real hashed bundle files
   (`index-*.css`, `index-*.js`). Nothing else.

## Verified against a real production build, not just dev mode

Dev mode's unbundled module serving makes a true offline test misleading (the cached HTML shell exists, but
none of its 200+ JS dependencies would be cached under the tightened rule, so the page would not actually
render). Ran `pnpm build`, served the real `dist/spa` + `dist/server/node-build.mjs` output, and confirmed:

- After one online visit + reload, the cache holds exactly the offline shell, logo, `/employee`'s
  navigation response, and the two real production bundle files.
- **A previously-visited page, reloaded while offline, renders the real dashboard** — not just a static
  shell; the actual React app mounts and shows live UI ("Shift status," stop counts, etc.) from cache.
- **A never-visited page (`/employee/timesheets`), loaded while offline, correctly shows the offline
  fallback page**, not a browser error screen.

## A real, more significant gap found during this verification — carried into Phase 3, not fixed here

Reloading `/employee` while offline initially rendered the **customer** dashboard's onboarding checklist,
not the technician dashboard. Root cause: `RequireEmployee.tsx` resolves the active role as
`profile?.role || user?.role` — when the live profile query fails (no network), it falls back to the role
baked into the JWT at sign-in time. For the test account used here, that JWT role was `"customer"` (set at
account creation via the dev-only test-account endpoint) even though its real `profiles.role` was later set
to `"technician"` directly in the database — the JWT was never refreshed to match. Offline, with no way to
refetch the real role, the stale JWT claim wins and the guard correctly-by-its-own-logic routes away from
the employee portal.

This is a real general gap, not just a test-account artifact: any employee whose role changes after their
last full sign-in would hit the same fallback if they went offline before re-authenticating. Since Phase 3
is exactly "make the employee portal work with cached data while offline," and a wrong-portal redirect makes
that cache unreachable regardless of how good the cache itself is, the fix (caching the last-known-good
employee role specifically for this offline-routing fallback, scoped to `RequireEmployee.tsx` only — not a
change to the shared `useProfile()` hook used by every portal) is implemented as part of Phase 3, not here.
See `OFFLINE_ROUTE_CACHE_REPORT.md`.
