# Quote/Acreage Regression Timeline

**Date:** 2026-06-11/12

---

## Method

```
git log --oneline --decorate -30
git log --oneline --all -- server/services/parcel/ client/components/sections/QuoteWidgetSection.tsx \
  server/routes/parcelQuote.ts server/routes/regrid.ts client/hooks/use-property-lookup.ts
```

## Recent commit history (last 13)

```
c49d934 (HEAD -> main, origin/main) Fix /api/* JSON body parsing: serverless-http 3.2.0 -> 4.0.0
303cdaf Fix Netlify build timeout: lazy-load server/ in vite.config.ts dev plugin
415c246 Fix Netlify build timeout: pre-bundle Netlify functions with esbuild
3767274 Fix Netlify build timeout: hoist node_modules to avoid pnpm symlink/nft hang
7640b6b Fix production API outage: remove express from external_node_modules
d83cd9a Production readiness sprint: email system, workflow verification, observability,
        admin operations, employee operations, beta launch preparation   <-- THE CHANGE
0865fba minor fixes to website
dea3b7d Implement Phase 3B admin service orders visibility, ...
e1b7b0e Implement Phase 3B admin service orders visibility, ... (dup)
a534fd1 Fix billing timeout handling and password reset routing
e49d90f Fix billing timeout handling and password reset routing (dup)
65c60f9 Fix billing timeout handling and password reset routing (dup)
5935889 Production hardening, repository cleanup, Phase 3A fixes, ...   <-- QuoteWidgetSection v1 added here
```

## File-level history of the quote/parcel pipeline

| File | Touched in | Notes |
|---|---|---|
| `client/components/sections/QuoteWidgetSection.tsx` | `5935889` (added, 360 lines), `d83cd9a` (rewritten, 764 lines changed) | Only two commits ever |
| `client/hooks/use-property-lookup.ts` | `5935889` (added), `d83cd9a` (rewritten) | Only two commits ever |
| `server/routes/regrid.ts` | `5935889` (added), `d83cd9a` (+207/-?, but route stays registered) | Hardcoded test-address stub present **since `5935889`**, untouched by `d83cd9a` |
| `server/services/parcel/**` (entire dir: adapters, `parcelLookupService.ts`, `googleAddressService.ts`, `countyDetector.ts`, `cache.ts`, `pricingQuote.ts`, `rateLimit.ts`, `geometry.ts`, `types.ts`) | `d83cd9a` only | **Brand new in this commit** — 1,742 insertions |
| `server/routes/parcelQuote.ts` | `d83cd9a` only | New route, `/api/parcel/quote` |
| `server/index.ts` | `d83cd9a` (+73 lines) | Registers new `/api/parcel` router alongside legacy `/api/regrid` |

## Headline finding

**There is exactly one regression point: commit `d83cd9a` ("Production readiness
sprint", 2026-06-08).** Everything related to county-GIS parcel lookups,
geocoding (`googleAddressService.ts`), county adapters, `countyDetector.ts`,
`featureFlags.ts`'s `parcelCountyLookup`/`regridFallback` flags, and the
rewritten `QuoteWidgetSection.tsx` / `usePropertyLookup` hook were **all
introduced together, in this single commit, three days before this report**.
No subsequent commit (including `c49d934`, this session's body-parser fix)
touched any of this logic.

The single behavioral change relevant to this investigation:

> `client/hooks/use-property-lookup.ts`'s `lookup()` function was repointed
> from `POST /api/regrid/parcel` (old, `server/routes/regrid.ts`) to
> `POST /api/parcel/quote` (new, `server/routes/parcelQuote.ts`).

`server/routes/regrid.ts` — including a **hardcoded special-case stub for the
exact test address** (`server/routes/regrid.ts:49-51`, present since the very
first version of this file in `5935889`) — is still in the codebase and still
registered at `/api/regrid` (`server/index.ts:197`, now commented
`// legacy — kept for backward compat; new flow uses /api/parcel`), but
**nothing in the frontend calls it anymore**. It is dead code from the
customer's perspective.

```ts
// server/routes/regrid.ts:48-52 (unchanged since 5935889, now unreachable from the UI)
if (address.toLowerCase().includes("caminito escobedo") || address.toLowerCase().includes("22216")) {
  console.log("[Regrid] Using pre-verified data for test address.");
  return res.json({ acreage: 0.07, sqft: 3049, note: "Data retrieved from local cache" });
}
```

See [QUOTE_OLD_VS_CURRENT_BEHAVIOR.md](./QUOTE_OLD_VS_CURRENT_BEHAVIOR.md) for
why this matters.

## Out of scope / not contributing factors

- `c49d934` (serverless-http upgrade) — fixed an unrelated, total-outage bug
  (`400 INVALID_ADDRESS` on every `/api/*` POST). Confirmed in
  [`reports/PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md`](../PARCEL_QUOTE_PRODUCTION_FIX_AND_GEOCODING_GAP_REPORT.md).
  Did not change quote/geocoding logic.
- `featureFlags.ts`, county adapters, `RegridFallbackAdapter.ts`,
  `ScagFallbackAdapter.ts` — all created fresh in `d83cd9a`, never modified
  since. `regridFallback` flag defaults to `false` and `RegridFallbackAdapter`
  is not wired into `ADAPTER_MAP` (`parcelLookupService.ts:17-23` — "Active
  county adapters only — SCAG and Regrid are not in this chain").
- `ScheduleFlow`, `AddPropertyDialog.tsx`, `AddressCheckerSection.tsx`,
  `HeroSection.tsx` — `HeroSection.tsx` has no quote logic (just a link to
  `/#quote`). `AddPropertyDialog.tsx` and `AddressCheckerSection.tsx` both
  consume the same `usePropertyLookup` hook and were updated for the new
  response shape in `d83cd9a`, but neither contains a behavioral regression
  beyond the same endpoint swap.
