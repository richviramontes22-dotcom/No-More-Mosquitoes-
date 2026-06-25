# Parcel Fallback & Error Handling Report

## Failure Mode Matrix

| Failure | Detection | Behavior |
|---------|-----------|---------|
| Address string empty | Input validation | HTTP 400 INVALID_ADDRESS |
| ZIP missing | Input validation | HTTP 400 INVALID_ADDRESS |
| Rate limit exceeded | In-memory bucket | HTTP 429 RATE_LIMITED + Retry-After header |
| Geocoding fails (Nominatim/Google) | null return | Proceeds without lat/lng; county adapters return null → SCAG/Regrid fallback |
| ZIP not in county map | detectCountyFromZip returns "unknown" | Skips primary adapter; goes directly to SCAG |
| County GIS returns 404/500 | !response.ok | Logs attempt, continues to next fallback |
| County GIS returns empty features | features.length === 0 | Logs attempt, continues to next fallback |
| County GIS times out | AbortError | Throws PROVIDER_TIMEOUT, logs attempt, continues |
| Acreage field missing from response | parseArcgisFeature returns null | Falls back to geometry calculation |
| Geometry rings missing or malformed | arcgisRingsToGeoJson returns null | Logs attempt, returns null from adapter |
| @turf/area returns NaN/zero/Infinity | calculateAcreage returns null | Adapter returns null |
| SCAG service unreachable | fetch throws | Logs attempt, skips to Regrid or manual |
| Regrid disabled | REGRID_FALLBACK_ENABLED=false | Skips entirely |
| Regrid not configured | REGRID_API_KEY missing | Skips entirely |
| All sources fail | parcelResult == null | HTTP 422 MANUAL_REVIEW_REQUIRED |
| Supabase admin client missing | supabaseAdmin == null | Cache silently skipped (lookup still proceeds) |
| Total timeout exceeded | deadline - Date.now() < 500 | Breaks chain, returns PROVIDER_TIMEOUT |

---

## Fallback Order

```
User request
    │
    ▼
[Supabase cache] ──hit──▶ return immediately (acreageSource: "cache")
    │ miss
    ▼
[Geocode address] (Nominatim free / Google optional)
    │
    ▼
[ZIP → county detection]
    │
    ├── orange     ──▶ [OrangeCountyAdapter]    ──success──▶ cache + return
    ├── riverside  ──▶ [RiversideCountyAdapter] ──success──▶ cache + return
    ├── san_diego  ──▶ [SanDiegoCountyAdapter]  ──success──▶ cache + return
    ├── los_angeles──▶ [LosAngelesCountyAdapter] (disabled) ──null──▶ continue
    └── unknown    ──▶ skip primary adapter
    │ null from primary
    ▼
[ScagFallbackAdapter] ──success──▶ cache + return (confidence: low)
    │ null
    ▼
[RegridFallbackAdapter] (disabled by default)
    │ null or disabled
    ▼
HTTP 422 MANUAL_REVIEW_REQUIRED
```

---

## Manual Review Behavior

When `MANUAL_REVIEW_REQUIRED` is returned:
- Frontend (QuoteWidgetSection) shows the amber fallback panel with manual acreage entry
- User can enter lot size manually and proceed to plan selector
- AddPropertyDialog shows amber fallback with "Use 0.25 ac" shortcut

**Important:** Manual entries are NOT cached (no address hash → DB row). Each lookup
for that address will attempt county GIS again on the next visit. This ensures that
when the county GIS eventually has the parcel (new construction lag), the correct
acreage is fetched.

---

## Error Codes Returned to Frontend

| Code | HTTP | Customer Message |
|------|------|-----------------|
| `INVALID_ADDRESS` | 400 | "Address and ZIP code are required." |
| `RATE_LIMITED` | 429 | "Too many requests. Please wait a moment." |
| `MANUAL_REVIEW_REQUIRED` | 422 | "We could not verify the lot size. Enter manually or contact us." |
| `PROVIDER_TIMEOUT` | 503 | (generic service error message) |
| `COUNTY_LOOKUP_FAILED` | 503 | (generic — triggers fallback, not exposed directly) |

**Raw county GIS errors are never exposed to the frontend.** All provider-specific
error details are logged server-side only (console.error + parcel_lookup_attempts table).

---

## Logging Strategy

### Server-side logs (console)
- `[Parcel] Attempt {provider}: ...` — each adapter attempt
- `[Parcel] Cache hit: {address}` — cache hits
- `[Parcel] Success via {source}: acreage={x}` — successful lookups

### Database logs (parcel_lookup_attempts)
Every adapter attempt is recorded with:
- `provider` — which adapter was tried
- `status` — success | failure
- `error_code` — structured error code
- `latency_ms` — response time
- `raw_error` — provider error object (server-side only, not exposed publicly)

### What is NOT logged
- Full address (only address_hash for PII protection)
- Owner information (never requested from county APIs)
- Tax or deed data (not requested)
- Raw county GIS response in frontend-facing responses

---

## Circuit Breaker Note

The current implementation does not implement a full circuit breaker pattern.
Repeated county GIS outages will be logged but the system will continue attempting
on each new request until the cache is warm.

For production hardening, consider adding a simple in-memory circuit breaker per
county adapter that suspresses calls for 5 minutes after 3 consecutive timeouts.
This can be added to `rateLimit.ts` without changing the adapter interface.
