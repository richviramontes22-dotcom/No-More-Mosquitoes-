# Real Coordinate Routing Report
**Date:** 2026-06-01

---

## Problem

The previous implementation used `mockGeocodeAddress()` for ALL stops, regardless of whether the property had real GPS coordinates. This meant:
- Route optimization produced geographically meaningless orderings
- Estimated travel times were fiction
- Confidence was always implicitly "unknown"

## Solution: Coordinate Resolution Priority

Implemented in `resolveCoordinates(prop)` in `adminRoutes.ts`:

```typescript
function resolveCoordinates(prop: any): ResolvedCoord {
  const lat = prop?.lat ?? prop?.latitude;
  const lng = prop?.lng ?? prop?.longitude;
  if (typeof lat === "number" && typeof lng === "number" && lat !== 0 && lng !== 0) {
    return { latitude: lat, longitude: lng, source: "property_coordinates" };
  }
  return { ...mockGeocodeAddress(prop?.address ?? "", prop?.zip ?? ""), source: "mock_fallback" };
}
```

### Priority Order

| Priority | Source | Used When |
|----------|--------|-----------|
| 1st | `properties.lat` / `properties.lng` | Column has non-null, non-zero value |
| 2nd (mock) | ZIP hash → approximate coordinate | No real coordinates available |

The query now includes `lat, lng` in the properties select for both single-tech and day-planner routes.

### Coordinate Sources Not Yet Wired
The following sources exist in the system but are not yet integrated (future sprint):
- `parcel_lookup_cache` table (Regrid cached coordinates)
- Google Geocoding API (requires `GOOGLE_MAPS_API_KEY`)
- Appointment-level coordinates (none exist in current schema)

These can be added to the priority chain in `resolveCoordinates()` without changing the rest of the code.

## `coordinate_source` Tracking

Each stop now tracks its source:
```typescript
type CoordSource = "property_coordinates" | "mock_fallback";
```

This is:
- Returned per stop in the generate response: `{ coordinate_source: "property_coordinates" }`
- Used for confidence calculation
- Stored in `routes.conflict_notes[]` when mock fallback is used

## Conflict Notes

When mock fallback is used for a stop:
```
"Stop at 123 Oak St, Irvine uses estimated coordinates — GPS data missing."
```

These notes are:
- Stored in `routes.conflict_notes` (text[] column)
- Returned in the generate API response as `coordinate_warnings`
- Displayed in the admin Day Planner UI as an amber warning badge per route card

## Property Coordinate Population

For this to help operationally, `properties.lat` and `properties.lng` must be populated. The existing `parcel-quote` Regrid integration already returns coordinates — they should be stored when a property is created or updated. This is a data backfill task, not a code change:

```sql
-- Query to see how many properties have coordinates
SELECT
  COUNT(*) AS total,
  COUNT(lat) AS has_lat,
  COUNT(lng) AS has_lng
FROM properties;
```

Properties created through the quote widget may already have coordinates. Properties added manually likely do not.
