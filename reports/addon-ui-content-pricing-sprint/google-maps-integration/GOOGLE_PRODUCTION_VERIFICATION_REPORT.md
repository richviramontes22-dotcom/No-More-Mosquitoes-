# Phase 8 — Production Verification

**Status:** ⚠️ **Still mostly blocked — but for one reason now, not two.**

1. ~~Phases 1–4 blocked~~ → **RESOLVED.** `GOOGLE_MAPS_SERVER_KEY` and
   `VITE_GOOGLE_MAPS_BROWSER_KEY` are both set in Netlify's `production`
   context (Phase 5), and the server key is confirmed working end-to-end
   locally (`source: "google"` — see
   [GOOGLE_LOCAL_ENV_REPORT.md](./GOOGLE_LOCAL_ENV_REPORT.md)).
2. **Phase 7 finding (unchanged)** → the Sprint 2 code that implements the
   Google autocomplete / lat-lng-placeId contract / Nominatim fallback is
   **still not deployed to production** (production is on commit `c49d9340`,
   predating all of it) — pending the user's commit/push decision.

The remaining blocker is now **purely Phase 7**. Once that's resolved, items
2–11 below should all become checkable on the *first* real production
request — there's no longer a missing-key blocker layered on top.

This report records what **was** checked and why each remaining item is
blocked, so Phase 9 can give an honest answer.

## What was checked

`https://nomoremosquitoes.us/pricing` was fetched. The page is live and
returns the expected title ("No More Mosquitoes | Premium Pest Control
Services | Orange County, CA"). Beyond that, **WebFetch converts the response
to static markdown and cannot execute the page's JavaScript** — this is a
React SPA, so the quote widget, autocomplete, and any `maps.googleapis.com`
script tags are rendered client-side and don't appear in the fetched markup.
A real browser (or Playwright/Puppeteer) would be needed for the visual/
interactive checks (items 2–5, 8–10 below). That was not run this session.

## 12-point checklist

| # | Check | Result |
|---|---|---|
| 1 | Visit `https://nomoremosquitoes.us/pricing#quote` | ✅ Site reachable, correct page loads. Hash-anchor scroll behavior not verified (requires browser). |
| 2 | Autocomplete dropdown appears | ❌ Blocked on Phase 7 only — `VITE_GOOGLE_MAPS_BROWSER_KEY` is now set in production, so once the code deploys, `useGoogleMapsScript()` should load the script and render the dropdown. |
| 3 | Select "22216 Caminito Escobedo, Laguna Hills, CA 92692" from dropdown | ❌ Blocked on #2 (i.e., on Phase 7) |
| 4 | Confirm fields populate from selection | ❌ Blocked on #2–3 |
| 5 | Submit quote | ⚠️ The quote form itself exists in current production (pre-Sprint-2), but submitting a real quote creates a record in the live production database — not done without separate confirmation, and not needed to validate Google Maps wiring specifically. |
| 6 | Backend receives `lat`/`lng`/`placeId` | ❌ Blocked — this contract is part of the undeployed `parcelLookupService.ts`/`types.ts` changes (Phase 7). Confirmed working **locally** end-to-end (Phase 6: `source:"google"`, real `placeId`). |
| 7 | `/api/parcel/quote` returns 200 | ⚠️ Not invoked against production this session (would require sending a real request to a live API — same production-side-effect consideration as #5). The endpoint exists pre-Sprint-2 and returned 200 in local testing for all 8 addresses, but that was against local dev, not this production deployment. |
| 8 | Oversized/shared-parcel panel shown where appropriate | ❌ Not verified against production — requires browser interaction with the quote form |
| 9 | Manual acreage pricing works | ❌ Not verified against production — requires browser interaction with the quote form |
| 10 | Unsupported addresses show fallback | ❌ Not verified against production — and the *specific* Nominatim-based fallback is part of the undeployed code (Phase 7) |
| 11 | Netlify logs show `parcel.geocode.success source="google"` for new addresses | ❌ Blocked on Phase 7 only — both prerequisites (key + a real request path) now exist; confirmed locally with the same log event shape. Will be checkable on Netlify Functions logs immediately after deploy. |
| 12 | `GOOGLE_MAPS_SERVER_KEY` not exposed in browser bundle / network calls | ⚠️ **Now a *meaningful* check** — the key is real and live in Netlify. Code review (prior sprint) confirmed `GOOGLE_MAPS_SERVER_KEY` is referenced only in `server/services/parcel/googleAddressService.ts` (server-side), never in `client/`. Must be re-confirmed against the actual built bundle once Phase 7 deploys — grep `dist/spa` for the key substring and confirm zero matches. |

## Bottom line for Phase 9

Phases 1–6 are now all complete (gcloud auth, APIs enabled, both keys
created/restricted, both keys live in Netlify `production` + local `.env`,
local end-to-end validation passing with `source:"google"`). The **only**
remaining step before this checklist can be meaningfully re-run is:
1. The Sprint 2 code is committed, pushed, and deployed (Phase 7 — pending
   user decision).
2. Then re-run this 12-point checklist against the *then-current* production
   with a real browser for the interactive items (2–5, 8–10), and grep
   `dist/spa` for item 12.

## Status against Phase 8 checklist

| Item | Status |
|---|---|
| Production site reachability checked | ✅ |
| Items verifiable without Google keys/deploy identified | ✅ (#1, #12) |
| Items blocked, with reasons, documented | ✅ (#2–11) |
| Full interactive re-run plan documented | ✅ Above |
