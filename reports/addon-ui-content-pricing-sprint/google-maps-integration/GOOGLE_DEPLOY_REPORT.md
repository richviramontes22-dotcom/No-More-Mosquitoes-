# Phase 7 — Production Deploy

**Status:** ⚠️ **Deferred — requires a user decision before proceeding.**
No deploy was triggered.

## Major finding: the entire Sprint 2 Google Maps implementation is uncommitted

`git status` / `git diff --stat` on `main` show:

```
HEAD: c49d9340 "Fix /api/* JSON body parsing: upgrade serverless-http 3.2.0 -> 4.0.0"
                (2026-06-11 — this is what's currently live on
                https://nomoremosquitoes.us via Netlify's auto-deploy-on-push)

Modified (11 files, +251/-19):
  .gitignore
  client/components/dashboard/properties/AddPropertyDialog.tsx
  client/components/sections/AddressCheckerSection.tsx
  client/components/sections/QuoteWidgetSection.tsx
  client/hooks/use-property-lookup.ts
  db/migrations/2026-06-01_workforce_sprint_a.sql   (unrelated to this sprint — see note below)
  server/lib/checkpoint.ts
  server/routes/parcelQuote.ts
  server/services/parcel/googleAddressService.ts
  server/services/parcel/parcelLookupService.ts
  server/services/parcel/types.ts

Untracked (new files):
  client/components/common/GoogleAddressAutocomplete.tsx
  client/lib/googleMapsLoader.ts
  client/types/
  scripts/test-quote-regression.ts
  server/services/parcel/googleAddressService.spec.ts
```

**Production (`https://nomoremosquitoes.us`) is currently running commit
`c49d9340` and does NOT include any of the Sprint 2 Google
Geocoding/Places-Autocomplete work** — the `GoogleAddressAutocomplete`
component, `googleMapsLoader`, the Google-first/Nominatim-fallback
`geocodeAddress()`, the extended parcel-lookup `lat/lng/placeId` contract,
etc. all exist only in the local working tree.

This was not previously surfaced in the Sprint 2 final report (which
validated behavior via local dev server, not production) — it's a material
fact for this CLI-setup sprint because **"production verification" (Phase 8)
and "production deploy" (this phase) only make sense once this code is
actually live.**

## What `npx netlify deploy --prod --build` would do right now

It builds and publishes the **current local working-tree state directly to
production**, bypassing `main`'s normal commit → push → Netlify
auto-deploy pipeline (confirmed in `netlify.toml`: build = `npm run
build:client && npm run bundle:functions`, publish = `dist/spa`, functions =
`dist/netlify-functions`).

That means it would ship to `nomoremosquitoes.us`:
- All 16 Sprint 2 files above (the intended Google Maps work for this sprint), **and**
- The modified `db/migrations/2026-06-01_workforce_sprint_a.sql` (2-line change to an
  already-applied migration — unrelated to this sprint, not reviewed as part
  of it), **and**
- Any other working-tree state at deploy time

...all **without a corresponding commit on `main`**, so the deployed
artifact would not match the git history until separately committed/pushed.

## Why this is deferred rather than executed

Per the operating guidelines for this session: production deploys are a
**hard-to-reverse, shared-system action** that should be confirmed with the
user, especially when:
1. It would deploy ~270 lines of uncommitted changes across 11 files plus 5
   new files — a full feature sprint — directly to production outside the
   normal review/push flow.
2. It bundles in an unrelated modified migration file that hasn't been
   reviewed in this sprint's context.
3. ~~There is nothing for Google Maps to activate yet anyway~~ — **this
   changed.** Phases 1–5 are now complete: `GOOGLE_MAPS_SERVER_KEY` and
   `VITE_GOOGLE_MAPS_BROWSER_KEY` are both set in Netlify's `production`
   context, and the server key is confirmed working end-to-end locally
   (`source: "google"`, real `placeId` — see
   [GOOGLE_LOCAL_ENV_REPORT.md](./GOOGLE_LOCAL_ENV_REPORT.md)). **This raises
   the stakes of decision A below**: deploying the Sprint 2 code now would
   make Google Geocoding + Places Autocomplete **immediately active in
   production** (not just "opt-in unconfigured" as originally assessed).

## Two decisions for the user

**A. Do you want the Sprint 2 Google Maps code committed and pushed to
`main`?** This is the normal path — Netlify auto-deploys on push (no
`netlify deploy` CLI call needed). I have not committed anything this
session (per "only commit when explicitly asked"). With real keys now live
in Netlify, saying yes here is effectively **"go live with Google Maps
now."**

**B. Separately — what should happen with the modified
`db/migrations/2026-06-01_workforce_sprint_a.sql`?** Per memory, this
migration was already verified as applied to Supabase production on
2026-06-08; it has since been edited locally by 2 lines. This is outside
this sprint's scope and should be reviewed/handled independently of the
Google Maps work — flagging it here only because it would ride along with
any `netlify deploy --prod --build` run from this working tree.

## Status against Phase 7 checklist

| Item | Status |
|---|---|
| Pre-deploy state assessed | ✅ Major finding above |
| `netlify deploy --prod --build` run | ❌ Deferred — needs user decision (A) |
| Deploy succeeded / failed | N/A — not run |
| Root-cause analysis (if failed) | N/A |
