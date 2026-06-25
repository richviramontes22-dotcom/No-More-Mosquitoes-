# Parcel Simplification Report

## Complexity Removed

| Removed | Reason |
|---------|--------|
| SCAG fallback (ScagFallbackAdapter) | Not parcel-accurate; not needed while county adapters are active |
| Regrid fallback (RegridFallbackAdapter) | Disabled entirely from active path; existing CA subscription covers nothing |
| `logAttempt` / `parcel_lookup_attempts` writes | Complexity without immediate value; console.error is sufficient |
| Admin cache route `GET /api/admin/parcel-cache` | Not needed for current operations |
| `/api/admin/parcel` route registration | Removed from server/index.ts |
| `CACHE_ENABLED` unused variable in route | Dead code |
| `supabaseAdmin` import in route file | No longer used after admin route removal |
| Google/Nominatim dual-geocoder complexity notes | Geocoder still present but SCAG comment removed |

Adapter files `ScagFallbackAdapter.ts` and `RegridFallbackAdapter.ts` are **retained on disk** (not deleted) so they can be re-enabled if needed, but they are not imported by `parcelLookupService.ts`.

---

## Active Runtime Path

```
POST /api/parcel/quote
    │
    ▼
validate address + ZIP
    │
    ▼
check parcel_lookup_cache (Supabase, permanent)
    │ hit → return immediately
    │ miss
    ▼
geocode address → lat/lng (Nominatim OSM, free; Google if key provided)
    │
    ▼
detect county from ZIP mapping
    │
    ├── orange      → OrangeCountyAdapter  → ocgis.com
    ├── riverside   → RiversideCountyAdapter → countyofriverside.us
    ├── san_diego   → SanDiegoCountyAdapter → sandag.org / sandiegocounty.gov
    ├── los_angeles → LosAngelesCountyAdapter (returns null — no stable public endpoint)
    └── unknown     → null adapter
    │
    ├── adapter returns acreage field   → confidence: high
    ├── adapter returns geometry only   → @turf/area → confidence: medium
    └── adapter returns null            → MANUAL_REVIEW_REQUIRED (HTTP 422)
    │
    ▼
save to parcel_lookup_cache
    │
    ▼
return { ok, normalizedAddress, county, apn, acreage, acreageSource, confidence, quote, cached }
```

---

## Files Changed

| File | Change |
|------|--------|
| `server/services/parcel/parcelLookupService.ts` | Removed SCAG, Regrid, logAttempt; simplified to 4-step flow |
| `server/routes/parcelQuote.ts` | Removed admin-cache route, CACHE_ENABLED var, supabaseAdmin import |
| `server/services/parcel/cache.ts` | Removed `logAttempt` export |
| `server/index.ts` | Removed `/api/admin/parcel` duplicate registration |

---

## Active County Adapters

| County | Status | GIS Source |
|--------|--------|-----------|
| Orange | ✅ Active | ocgis.com MapServer/0 |
| Riverside | ✅ Active | countyofriverside.us MapServer/4 |
| San Diego | ✅ Active (dual-layer) | sandag.org + sandiegocounty.gov |
| Los Angeles | ⚠️ Returns null | No stable unauthenticated public endpoint confirmed |
| SCAG | 🚫 Removed from path | File kept on disk, not imported |
| Regrid | 🚫 Removed from path | File kept on disk, not imported |

---

## Frontend Integration Points

| Component | Endpoint used | Notes |
|-----------|--------------|-------|
| `QuoteWidgetSection.tsx` (homepage + pricing page) | `POST /api/parcel/quote` | Shows acreage, confidence badge, pricing quote |
| `use-property-lookup.ts` hook | `POST /api/parcel/quote` | Used by QuoteWidgetSection and AddPropertyDialog |
| `AddPropertyDialog.tsx` | via `use-property-lookup` | Shows amber fallback when lookup fails |
| `ScheduleFlow.tsx` / onboarding | via `use-property-lookup` | Acreage flows into pendingOnboarding |

---

## Validation Results

- `pnpm typecheck` → 0 errors
- `pnpm build` → see build output
- No changes to Stripe, ScheduleFlow, billing, or onboarding payment paths

---

## Deferred

| Item | Status |
|------|--------|
| SCAG fallback | Adapter file retained; wire back in if county adapters prove insufficient |
| Regrid fallback | Adapter file retained; enable only with valid CA-covering subscription |
| LA County adapter | Returns null until a stable unauthenticated public ArcGIS endpoint is confirmed |
| Redis hot cache | Not needed at current volume; add if latency becomes an issue at scale |
| Circuit breaker per adapter | Add to `rateLimit.ts` if repeated county GIS outages occur |
| `parcel_lookup_attempts` table | Migration creates it; writes deferred until debug logging is needed |
