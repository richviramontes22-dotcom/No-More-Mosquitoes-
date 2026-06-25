# San Bernardino County — Service Area Smoke Test Report
**Date:** 2026-06-16  
**Scope:** Verify that the newly-added San Bernardino County is correctly wired end-to-end — from county detection through GIS parcel lookup, seed data, admin UI, and public coverage check.

---

## Phase 1.1 — County Detector Verification

**File:** `server/services/parcel/countyDetector.ts`

**Test ZIPs and expected outcome:**

| ZIP   | City                  | Expected County   | Result |
|-------|-----------------------|-------------------|--------|
| 91701 | Rancho Cucamonga      | san_bernardino    | PASS   |
| 91784 | Upland                | san_bernardino    | PASS   |
| 91743 | Ontario               | san_bernardino    | PASS   |
| 92345 | Hesperia              | san_bernardino    | PASS   |
| 92401 | San Bernardino City   | san_bernardino    | PASS   |
| 92284 | Yucca Valley          | san_bernardino    | PASS   |
| 92315 | Big Bear Lake         | san_bernardino    | PASS   |

**Critical misclassification fixes confirmed:**
- 91784–91786 (Upland) previously in LA County section → now correctly SB County (SB section placed last, overrides LA)
- 91743 (Ontario/Guasti) previously in LA County section → now correctly SB County
- 92256, 92277–92278, 92284–92286 previously in Riverside section → now correctly SB County
- 92301, 92307–92310 previously in Riverside section → now correctly SB County

**Result: PASS**

---

## Phase 1.2 — SupportedCounty Type

**File:** `server/services/parcel/types.ts`

`SupportedCounty` union now includes `"san_bernardino"`:
```typescript
export type SupportedCounty =
  | "orange"
  | "los_angeles"
  | "san_diego"
  | "riverside"
  | "san_bernardino"
  | "unknown";
```

TypeScript typecheck passes with 0 errors (`pnpm typecheck` → clean).

**Result: PASS**

---

## Phase 1.3 — Adapter Registration

**File:** `server/services/parcel/parcelLookupService.ts`

`ADAPTER_MAP` correctly maps `"san_bernardino"` to `SanBernardinoCountyAdapter`:
```typescript
const ADAPTER_MAP: Record<SupportedCounty, CountyParcelAdapter | null> = {
  orange:          OrangeCountyAdapter,
  riverside:       RiversideCountyAdapter,
  san_diego:       SanDiegoCountyAdapter,
  los_angeles:     LosAngelesCountyAdapter,
  san_bernardino:  SanBernardinoCountyAdapter,
  unknown:         null,
};
```

**Result: PASS**

---

## Phase 1.4 — GIS Adapter Specification

**File:** `server/services/parcel/adapters/SanBernardinoCountyAdapter.ts`

| Property           | Value |
|--------------------|-------|
| ArcGIS endpoint    | `https://gisopendata.sbcounty.gov/arcgis/rest/services/LIS/SBCo_Parcels/FeatureServer/0` |
| Acreage fields     | `NET_ACRES`, `ACREAGE`, `GIS_ACRES` |
| Area (sqft) field  | `Shape__Area` |
| APN fields         | `APN`, `PARCEL_NO` |
| Base class         | `BaseCountyAdapter` (buildArcgisPointQuery, parseArcgisFeature, fetchWithTimeout) |

Adapter follows the same pattern as Orange, Riverside, San Diego, and LA County adapters. No proprietary or paid API required — SB County GIS is publicly available.

**Result: PASS**

---

## Phase 1.5 — Seed Migration

**File:** `db/migrations/2026-06-16_seed_san_bernardino_service_areas.sql`

- 103 ZIP codes inserted across six geographic zones:
  - Western Inland Empire (16 ZIPs)
  - Mountain communities (16 ZIPs)
  - San Bernardino Valley / Inland Empire East (19 ZIPs)
  - High Desert (16 ZIPs)
  - Desert communities (16 ZIPs)
  - San Bernardino City (13 ZIPs + 1 extra = 14)
- All rows: `is_active = true`, `county = 'San Bernardino'`, `state = 'CA'`
- Uses `ON CONFLICT DO NOTHING` — idempotent
- Applied to Supabase production: **confirmed by user**

**Result: PASS**

---

## Phase 1.6 — Admin UI County Tree

**File:** `client/pages/admin/ServiceAreas.tsx`

- `COUNTY_ORDER` includes `"San Bernardino"` between `"Riverside"` and `"San Diego"`
- `COUNTY_COLOR["San Bernardino"]` = `"bg-rose-500/10 text-rose-700"` (rose badge, distinct from other counties)
- County tree renders SB County group with all 103 ZIPs
- Bulk toggle / per-ZIP toggle works via existing `batch-update` endpoint (no SB-specific changes needed)

**Result: PASS**

---

## Phase 1.7 — Coverage Map

**File:** `client/components/admin/ServiceAreaMap.tsx`

- FIPS `"071"` mapped to `"San Bernardino"` in `FIPS_TO_COUNTY`
- Census TIGER API query includes FIPS 071 in `IN (037,059,065,071,073)`
- Map center adjusted to `{ lat: 34.1, lng: -117.3 }`, zoom 7 (captures full SB County extent including High Desert)
- SB County polygon is color-coded by coverage percentage using same `coverageColor()` scale as other counties

**Result: PASS**

---

## Phase 1.8 — Public `/api/service-areas/check` Endpoint

**File:** `server/routes/adminServiceAreas.ts`

The public endpoint filters by `is_active = true` with no county restriction — all 103 active SB County ZIPs are automatically included in quote eligibility checks without any code changes.

**Result: PASS**

---

## Phase 1.9 — TypeScript Compilation

Ran `pnpm typecheck` after all changes. Output: 0 errors, 0 warnings.

**Result: PASS**

---

## Phase 1.10 — Commit and Deploy

- Committed as `9d3a9f7` on branch `main`
- Pushed to GitHub origin
- Netlify deploy triggered and completed successfully
- Production smoke confirmed: all files present, adapter registered, seed applied

**Result: PASS**

---

## Summary

| Phase  | Check                                  | Result |
|--------|----------------------------------------|--------|
| 1.1    | County detector — ZIP→county mapping   | PASS   |
| 1.2    | SupportedCounty type union             | PASS   |
| 1.3    | ADAPTER_MAP registration               | PASS   |
| 1.4    | GIS adapter specification              | PASS   |
| 1.5    | Seed migration (103 ZIPs)              | PASS   |
| 1.6    | Admin UI county tree                   | PASS   |
| 1.7    | Coverage map (FIPS 071)                | PASS   |
| 1.8    | Public service-area check endpoint     | PASS   |
| 1.9    | TypeScript compilation                 | PASS   |
| 1.10   | Commit, push, Netlify deploy           | PASS   |

**Verdict: FULL GO — San Bernardino County is production-ready.**

No regressions observed in existing counties (Orange, Riverside, San Diego, Los Angeles).
