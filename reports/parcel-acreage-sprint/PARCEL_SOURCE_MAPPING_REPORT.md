# Parcel Source Mapping Report

## Orange County
**Endpoint:** `https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0`
**Query method:** ArcGIS point-in-polygon (outSR=4326)

| Field tried | Meaning | Priority |
|-------------|---------|---------|
| LANDAREA | Lot area in acres | 1st |
| LOTAREA | Lot area in acres | 2nd |
| PARCEL_AREA_ACRES | GIS-calculated acres | 3rd |
| GIS_AREA_ACRES | GIS-calculated acres | 4th |
| CALC_ACREAGE | Calculated acreage | 5th |
| LANDAREA_SF / LOT_SF / SQFT | Sq ft → converted | 6th |
| Shape_Area | Sq meters → converted | 7th |
| rings (geometry) | @turf/area from polygon | Last resort |

**APN fields:** APN, ASSESSOR_PARCEL_NO, PARCEL_NO, PARCEL_ID, APN_FORMATTED
**Confidence:** high (county_field) / medium (geometry_calculated)
**Coverage:** All Orange County parcels

---

## Riverside County
**Endpoint:** `https://gis.countyofriverside.us/arcgis_mapping/rest/services/Transportation/06_Parcels_Mapping_v2/MapServer/4`
**Query method:** ArcGIS point-in-polygon (outSR=4326)

| Field tried | Meaning | Priority |
|-------------|---------|---------|
| ACREAGE / ACRES | Lot area in acres | 1st |
| CALC_ACRES / NET_ACRES / GIS_ACRES | Calculated acres | 2nd-4th |
| SQFT / AREA_SQFT / LOT_SQFT | Sq ft → converted | 5th |
| Shape_Area | Sq meters → converted | 6th |
| rings (geometry) | @turf/area from polygon | Last resort |

**APN fields:** APN, PARCEL, PARCEL_NO, APN_DASH, ASSESSOR_NO
**Confidence:** high (county_field) / medium (geometry_calculated)

---

## San Diego County
**Primary endpoint:** `https://gissd.sandag.org/rdw/rest/services/Parcel/Parcels/MapServer/1`
**Secondary endpoint:** `https://gis-public.sandiegocounty.gov/arcgis/rest/services/sdep_warehouse/ADDRAPN/FeatureServer/0`
**Query method:** ArcGIS point-in-polygon, tries primary then secondary

| Field tried | Meaning | Priority |
|-------------|---------|---------|
| ACREAGE / ACRES | Lot area in acres | 1st |
| LND_AREA_AC / LAND_AREA_AC / GIS_ACREAGE | Calculated acres | 2nd-4th |
| SQFT / LND_AREA_SF / LAND_AREA_SF | Sq ft → converted | 5th |
| Shape_Area | Sq meters → converted | 6th |
| rings (geometry) | @turf/area from polygon | Last resort |

**APN fields:** APN, PARCEL, PARCEL_NUMBER, APN_NUM, APN_FORMATTED
**Confidence:** high (county_field) / medium (geometry_calculated)

---

## Los Angeles County
**Status:** ⚠️ DISABLED (`LA_COUNTY_ADAPTER_ENABLED=false`)

**Audit findings (2026-05):** The primary LA County ArcGIS parcel endpoint
(`arcgis.gis.lacounty.gov/arcgis/rest/services/ACGISA/LandBase/MapServer/10`)
requires a Spatial Subscription token for production use. The unauthenticated
endpoint is throttled and returns inconsistent results under automated load.

**Recommendation:** Contact LA County GIS at lacounty.gov/gis/ to inquire about
a public API agreement, or monitor for a stable public ArcGIS service release.
Until then, LA County addresses fall through to SCAG fallback.

**Candidate fields (for when re-enabled):**
Shape_Area_ACRES, ACREAGE, ACRES, NET_AREA_AC, GIS_ACRES, LotArea, SQFT, NET_AREA_SF

---

## SCAG Regional Fallback
**Endpoint:** `https://rdp.scag.ca.gov/mapping/rest/services/Housing/2019_Annual_Land_Use_NAD83/MapServer/0`

**Important:** This is a **land-use layer**, not a parcel-boundary layer. The polygon
returned represents the broader land-use zone, not the exact parcel. Acreage derived
here is approximate and reported with `confidence: "low"`.

**Use case:** LA County addresses, rural/unincorporated addresses where county adapter returns null.

---

## Acreage Field Priority (all adapters)

1. Dedicated acreage field (acres) → `confidence: "high"`
2. Square footage field → convert via ÷ 43,560 → `confidence: "high"`
3. Square meters field → convert via ÷ 4046.856 → `confidence: "high"`
4. Geometry rings → @turf/area → square meters → acres → `confidence: "medium"`
5. SCAG polygon geometry → `confidence: "low"`

---

## Geometry Behavior

All adapters request `returnGeometry=true&outSR=4326` so returned rings are in
WGS84 geographic coordinates (longitude, latitude). The `arcgisRingsToGeoJson()`
function in `geometry.ts` converts ArcGIS ring format to GeoJSON Polygon or
MultiPolygon. `@turf/area` then computes the geodesic area in square meters,
which is divided by 4046.856 to get acres. This handles the Earth's curvature
correctly for Southern California latitudes (~33°N).

---

## Confidence Rules

| Source | Confidence | When |
|--------|-----------|------|
| cache | (inherits) | Cache hit |
| county_field | high | Dedicated acreage/sqft field from county GIS |
| geometry_calculated | medium | Calculated from parcel polygon geometry |
| scag_fallback | low | SCAG land-use layer (approximate polygon) |
| regrid_fallback | medium | Regrid parcel data |
| manual | low | User entered manually in frontend |
