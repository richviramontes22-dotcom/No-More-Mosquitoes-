# Service Area Map Report
Generated: 2026-06-16

## Component: `client/components/admin/ServiceAreaMap.tsx`

## Map Initialization
- Center: `{ lat: 34.1, lng: -117.3 }` — covers all 5 SoCal counties ✓
- Zoom: 7 — wide enough for LA + SB County (which extends far NE) ✓
- `disableDefaultUI: true`, `gestureHandling: "cooperative"` ✓
- Map initializes only once via `mapInstanceRef.current` guard ✓

## FIPS → County Mapping
| FIPS | County | Status |
|---|---|---|
| 037 | Los Angeles | ✓ |
| 059 | Orange | ✓ |
| 065 | Riverside | ✓ |
| 071 | San Bernardino | ✓ (added in 9d3a9f7) |
| 073 | San Diego | ✓ |

## Census TIGER API Query
- URL: `tigerweb.geo.census.gov/.../State_County/MapServer/1/query`
- Filter: `STATE='06' AND COUNTY IN ('037','059','065','071','073')` — all 5 counties ✓
- `outSR=4326` (WGS84 lat/lng) ✓
- Module-level cache `cachedGeoJson` prevents duplicate fetches ✓

## Three-Effect Architecture (stale closure fix)
| Effect | Trigger | Action |
|---|---|---|
| Effect 1 | `mapsStatus === "ready"` | Init map + InfoWindow once |
| Effect 2 | `mapInstanceRef.current` (runs once) | Load GeoJSON, wire `mouseover/mouseout/click` listeners via `geoLoadedRef` guard |
| Effect 3 | `JSON.stringify(countyStats)` | Re-style all features via `overrideStyle` — no listener accumulation |

- `countyStatsRef` always-current ref used inside event handlers (no stale closure) ✓
- `onCountyClickRef` always-current ref used in click handler ✓

## Hover Behavior
```typescript
map.data.addListener("mouseover", (e) => {
  map.data.overrideStyle(e.feature, { fillOpacity: 0.82, strokeWeight: 3 });
  // InfoWindow shows: county name, active/total, pct%
});
map.data.addListener("mouseout", () => {
  map.data.revertStyle();
  infoWindowRef.current?.close();
});
```
- Info window content: `"{County} County" + "{active}/{total} ZIPs active ({pct}%)"` ✓
- Hover highlight with increased opacity + stroke weight ✓

## Click Behavior
```typescript
map.data.addListener("click", (e) => {
  const fips = e.feature.getProperty("COUNTY") as string;
  const county = FIPS_TO_COUNTY[fips];
  if (county) onCountyClickRef.current(county);  // → focusCounty() in parent
});
```
- Click fires `focusCounty(county)` in ServiceAreas.tsx ✓
- `focusCounty` adds county to `expandedCounties` and scrolls tree ✓

## Coverage Color Logic
| Condition | Color |
|---|---|
| 100% | `#16a34a` (dark green) |
| ≥75% | `#22c55e` (green) |
| ≥50% | `#86efac` (light green) |
| ≥25% | `#fbbf24` (amber) |
| >0% | `#d1d5db` (light gray) |
| 0% | `#9ca3af` (gray) |

- Color updates on each toggle without page refresh (Effect 3 re-runs) ✓
- Legend rendered in bottom-right corner ✓

## Error States
- `mapsStatus === "idle"` (no API key) → placeholder with MapIcon message ✓
- `mapsStatus === "error"` → error message ✓
- `mapsStatus === "loading"` → spinner overlay ✓
- GeoJSON fetch failure → `"County outlines unavailable"` banner ✓

## Status: PASS
