# Parcel Acreage System — Deployment Guide

## 1. Run the Database Migration

In your Supabase Dashboard → SQL Editor, run:

```
db/migrations/2026-05-26_parcel_lookup_cache.sql
```

This creates:
- `parcel_lookup_cache` — permanent acreage cache
- `parcel_lookup_attempts` — optional debug/audit log

PostGIS must be enabled first:
- Supabase Dashboard → Database → Extensions → search "postgis" → Enable

Verify the geometry column exists after running:
```sql
select column_name, data_type from information_schema.columns
where table_name = 'parcel_lookup_cache' and column_name = 'geometry';
```

---

## 2. Required Environment Variables

Add these to your Netlify environment (Site Settings → Environment variables):

```bash
# Required for parcel lookups to cache results
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # already set

# Optional — enables Google Geocoding (more accurate than Nominatim)
GOOGLE_MAPS_SERVER_KEY=AIza...     # keep backend-only, NEVER expose to browser

# Optional — enables Google Places Autocomplete on frontend
# Restrict this key in GCP to your domain: nomoremosquitoes.us
VITE_GOOGLE_MAPS_BROWSER_KEY=AIza...

# Parcel system configuration (sensible defaults shown)
PARCEL_CACHE_ENABLED=true
PARCEL_LOOKUP_TIMEOUT_MS=8000
COUNTY_ADAPTER_TIMEOUT_MS=4000
PARCEL_RATE_LIMIT_ANON_PER_HOUR=20
PARCEL_RATE_LIMIT_AUTH_PER_HOUR=100
LA_COUNTY_ADAPTER_ENABLED=false
REGRID_FALLBACK_ENABLED=false
```

---

## 3. New API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/parcel/quote` | Main acreage + pricing endpoint |
| `GET` | `/api/admin/parcel/admin-cache?address=...` | Debug cache inspection |

---

## 4. Packages Added

```
@turf/area   7.3.5   — Geodesic area calculation from GeoJSON polygons
@turf/helpers 7.3.5  — GeoJSON helper types
```

No breaking changes to existing dependencies.

---

## 5. Netlify Function Considerations

The county GIS adapters make outbound HTTP requests. Netlify Functions have:
- 10-second execution limit (background functions: 15 min)
- The system's total timeout is 8 seconds (`PARCEL_LOOKUP_TIMEOUT_MS=8000`)
- Each county adapter timeout: 4 seconds (`COUNTY_ADAPTER_TIMEOUT_MS=4000`)
- These fit comfortably within the Netlify limit

The rate limiter uses an in-memory Map. On Netlify Functions (stateless/ephemeral),
this resets per cold start. For production-grade rate limiting, use a Redis store
(`REDIS_URL` + `PARCEL_REDIS_CACHE_ENABLED=true`). For current NMM volume this
is not necessary.

---

## 6. Verifying Deployment

After deploying, test with a known Orange County address:

```bash
curl -X POST https://nomoremosquitoes.us/api/parcel/quote \
  -H "Content-Type: application/json" \
  -d '{"address":"100 Civic Center Dr","zip":"92801","city":"Anaheim","state":"CA"}'
```

Expected response:
```json
{
  "ok": true,
  "normalizedAddress": "...",
  "county": "orange",
  "acreage": 0.45,
  "acreageSource": "county_field",
  "confidence": "high",
  "quote": { "programs": { ... } },
  "cached": false
}
```

Second call should return `"cached": true` immediately.

---

## 7. No Docker Required

This app deploys on Netlify + Supabase. Docker is not part of the deployment
architecture. If you ever migrate to a self-hosted server, use:
```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
```

---

## 8. Monitoring

Check `parcel_lookup_attempts` in Supabase for:
- `status = 'failure'` entries (indicates county GIS issues)
- `error_code = 'PROVIDER_TIMEOUT'` (county GIS too slow)
- `error_code = 'MANUAL_REVIEW_REQUIRED'` (addresses that need follow-up)

Check `parcel_lookup_cache` for cache growth and hit rates:
```sql
select county, count(*), avg(hit_count) from parcel_lookup_cache group by county;
```
