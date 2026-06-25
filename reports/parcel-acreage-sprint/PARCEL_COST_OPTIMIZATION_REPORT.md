# Parcel Cost Optimization Report

## Regrid Reduction Strategy

Regrid is now **disabled by default** (`REGRID_FALLBACK_ENABLED=false`).

The existing `/api/regrid/parcel` route is preserved but is no longer called by
any new code path. It can be removed entirely once the county adapter chain has
been validated in production.

The Regrid subscription covering California was confirmed to be missing California
parcel data. Even if CA coverage is added, Regrid is now only used as a last-resort
fallback after all public county GIS and SCAG sources fail.

---

## County GIS Cost

All county GIS endpoints used are **free public ArcGIS REST APIs**:
- Orange County: ocgis.com — no auth required
- Riverside County: countyofriverside.us — no auth required
- San Diego County: sandag.org / sandiegocounty.gov — no auth required
- SCAG fallback: rdp.scag.ca.gov — no auth required

**Zero marginal cost per query.** Rate limits are lenient for residential/commercial
lookup volumes. Each adapter enforces a 4-second timeout to prevent hanging requests.

---

## Google Maps Cost Controls

Google Geocoding is **optional** (only runs when `GOOGLE_MAPS_SERVER_KEY` is set).

When not configured, the system uses OpenStreetMap Nominatim (free, 1 req/sec limit).
For NMM's volume (~100–300 lookups/month with caching), Nominatim is sufficient.

If Google Geocoding is enabled:
- Use **session tokens** (for Places Autocomplete) to bundle autocomplete + detail calls
- Cache geocode results in `parcel_lookup_cache` (lat/lng stored permanently)
- Never geocode the same address twice
- Google Geocoding API cost: ~$0.005/call → at 300 uncached calls/month → ~$1.50/month

---

## Caching Strategy

### Database Cache (Supabase)
- Permanent — parcel boundaries change very rarely
- Every successful lookup cached (county_field, geometry_calculated, scag_fallback, regrid_fallback)
- Cache keyed by SHA-256(normalized_address) — first 32 hex chars
- Secondary key: placeId (when provided via Google Places)
- `hit_count` tracks cache utilization per address

### Cache Hit Rate Projection
After the first lookup for any given address, all subsequent lookups are free (DB read only).
For an established customer base:
- Month 1: 100% miss rate (cold start)
- Month 3+: 70-80%+ hit rate (repeat customers, existing properties)
- Steady state: ~95% hit rate

### In-Flight Deduplication
Concurrent identical requests (e.g., user double-clicks "Get Price") are merged
into a single county GIS call via the in-flight Promise map in `parcelLookupService.ts`.

---

## Expected Monthly Cost Profile

| Volume | Google Maps | County GIS | Regrid | Total |
|--------|------------|-----------|--------|-------|
| 100 quotes/mo (cold) | $0.50 | $0 | $0 | ~$0.50 |
| 300 quotes/mo (cold) | $1.50 | $0 | $0 | ~$1.50 |
| 1,000 quotes/mo (warm cache 70%) | $1.50 | $0 | $0 | ~$1.50 |
| No Google Maps key | $0 | $0 | $0 | **$0** |

**Target cost: $0/month for the foreseeable future using Nominatim + county GIS.**

---

## Manual Review Instead of Expensive Fallback

When all public sources fail, the system returns `MANUAL_REVIEW_REQUIRED` (HTTP 422)
rather than making expensive repeated fallback calls. The frontend shows a message
directing the customer to contact NMM for a custom quote.

This prevents repeated county GIS calls for addresses that will never resolve
(e.g., new construction not yet in the county system, rural parcels).
