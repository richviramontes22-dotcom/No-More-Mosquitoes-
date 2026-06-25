# Parcel Acreage System Report

## Architecture Implemented

Cache-first, county-GIS-primary acreage lookup system replacing Regrid as the default source.

### Lookup Flow
1. Frontend sends `{ address, zip, city, state, lat?, lng?, placeId? }` to `POST /api/parcel/quote`
2. Server checks in-flight deduplication map (prevents hammering county GIS for identical concurrent requests)
3. Server checks Supabase `parcel_lookup_cache` by address hash (and placeId if provided)
4. **Cache hit** → returns immediately with `acreageSource: "cache"`
5. **Cache miss** → geocodes address via Google Geocoding (if `GOOGLE_MAPS_SERVER_KEY` set) or OpenStreetMap Nominatim (free fallback)
6. Detects county from ZIP code mapping (fast, no API cost)
7. Queries primary county GIS adapter via ArcGIS point-in-polygon spatial query
8. If county adapter returns null → tries SCAG regional fallback
9. If SCAG fails and `REGRID_FALLBACK_ENABLED=true` → tries Regrid as last resort
10. All successful results cached permanently in Supabase
11. Returns normalized address, county, APN, acreage, confidence, and pricing quote

### Regrid Status
Regrid is **disabled by default** (`REGRID_FALLBACK_ENABLED=false`). The existing `/api/regrid/parcel` route is preserved for backward compatibility but is not called by any new code path.

## Files Created

### Server Services
| File | Purpose |
|------|---------|
| `server/services/parcel/types.ts` | Shared TypeScript types (SupportedCounty, AcreageSource, Confidence, etc.) |
| `server/services/parcel/geometry.ts` | ArcGIS ring → GeoJSON conversion; @turf/area acreage calculation |
| `server/services/parcel/countyDetector.ts` | ZIP → county mapping for OC, Riverside, SD, LA |
| `server/services/parcel/googleAddressService.ts` | Geocoding via Google (preferred) or Nominatim (free fallback) |
| `server/services/parcel/cache.ts` | Supabase parcel_lookup_cache read/write + logAttempt |
| `server/services/parcel/pricingQuote.ts` | Server-authoritative pricing tier tables + quote builder |
| `server/services/parcel/rateLimit.ts` | In-memory IP rate limiter (anon: 20/hr, auth: 100/hr) |
| `server/services/parcel/parcelLookupService.ts` | Orchestration: geocode → detect county → adapter chain → cache |

### Adapters
| File | County | Source |
|------|--------|--------|
| `adapters/BaseCountyAdapter.ts` | — | ArcGIS query builder + feature parser |
| `adapters/OrangeCountyAdapter.ts` | Orange | ocgis.com MapServer layer 0 |
| `adapters/RiversideCountyAdapter.ts` | Riverside | countyofriverside.us MapServer layer 4 |
| `adapters/SanDiegoCountyAdapter.ts` | San Diego | sandag.org + sandiegocounty.gov (dual-layer) |
| `adapters/LosAngelesCountyAdapter.ts` | Los Angeles | Disabled pending stable public endpoint audit |
| `adapters/ScagFallbackAdapter.ts` | Regional | SCAG 2019 Land Use NAD83 layer |
| `adapters/RegridFallbackAdapter.ts` | Any | Regrid v2 (disabled by default) |

### Route + Registration
| File | Purpose |
|------|---------|
| `server/routes/parcelQuote.ts` | `POST /api/parcel/quote` + `GET /api/admin/parcel-cache` |
| `server/index.ts` | Registered at `/api/parcel` and `/api/admin/parcel` |

### Frontend
| File | Change |
|------|--------|
| `client/hooks/use-property-lookup.ts` | Rewritten to call `/api/parcel/quote`; returns county, confidence, acreageSource, quote |
| `client/components/sections/QuoteWidgetSection.tsx` | Displays confidence badge + low-confidence notice in Phase 2 |

### Database
| File | Purpose |
|------|---------|
| `db/migrations/2026-05-26_parcel_lookup_cache.sql` | parcel_lookup_cache + parcel_lookup_attempts tables + indexes |

## County Adapters Implemented

| County | Status | Endpoint |
|--------|--------|----------|
| Orange | ✅ Active | ocgis.com — ArcGIS point query |
| Riverside | ✅ Active | countyofriverside.us — ArcGIS point query |
| San Diego | ✅ Active (dual-layer) | sandag.org + sandiegocounty.gov |
| Los Angeles | ⚠️ Disabled | Audit required — `LA_COUNTY_ADAPTER_ENABLED=false` |
| SCAG (fallback) | ✅ Active | rdp.scag.ca.gov — regional land use |
| Regrid (fallback) | ⚠️ Disabled | `REGRID_FALLBACK_ENABLED=false` |

## Cache Behavior

- Permanent by default (parcel boundaries rarely change)
- Keyed by SHA-256 hash of normalized address (first 32 hex chars)
- Secondary lookup by placeId when provided
- `hit_count` and `last_accessed_at` updated on every cache hit (async, non-blocking)
- Concurrent identical requests deduplicated via in-flight Promise map

## Validation Results

- `pnpm typecheck` → 0 errors
- Zero breaking changes to existing flows (Stripe, scheduling, billing, onboarding)
