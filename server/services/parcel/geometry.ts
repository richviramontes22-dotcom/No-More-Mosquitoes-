import area from "@turf/area";
import { polygon, multiPolygon } from "@turf/helpers";
import type { GeoJsonPolygon, GeoJsonMultiPolygon } from "./types";

const SQ_METERS_PER_ACRE = 4046.8564224;

/**
 * Convert ArcGIS geometry rings (returned by esriGeometryPolygon) to GeoJSON.
 * ArcGIS rings use [longitude, latitude] order when outSR=4326.
 * Outer rings are clockwise; holes are counter-clockwise in ESRI convention —
 * GeoJSON is the opposite, but @turf/area handles both.
 */
export function arcgisRingsToGeoJson(
  rings: number[][][],
): GeoJsonPolygon | GeoJsonMultiPolygon | null {
  if (!rings || rings.length === 0) return null;

  if (rings.length === 1) {
    return { type: "Polygon", coordinates: rings };
  }

  // Multiple rings — treat each as its own polygon for area purposes.
  // Ideally we'd detect outer vs hole rings, but for acreage totaling outer-only is fine.
  return {
    type: "MultiPolygon",
    coordinates: rings.map(ring => [ring]),
  };
}

/**
 * Calculate acreage from a GeoJSON polygon or multi-polygon.
 * Returns null if the result is invalid (NaN, zero, negative, unreasonably large).
 */
export function calculateAcreage(
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon,
): number | null {
  try {
    const sqMeters =
      geometry.type === "Polygon"
        ? area(polygon(geometry.coordinates))
        : area(multiPolygon(geometry.coordinates));

    const acres = sqMeters / SQ_METERS_PER_ACRE;

    if (!isFinite(acres) || isNaN(acres) || acres <= 0) return null;
    // Sanity cap — anything over 500 acres is a farm/industrial, skip automatic quoting.
    if (acres > 500) return null;

    return Math.round(acres * 1000) / 1000;
  } catch {
    return null;
  }
}

/** Convert square feet to acres, rounded to 3 decimal places. */
export function sqftToAcres(sqft: number): number {
  return Math.round((sqft / 43560) * 1000) / 1000;
}

/** Convert square meters to acres, rounded to 3 decimal places. */
export function sqMetersToAcres(sqm: number): number {
  return Math.round((sqm / SQ_METERS_PER_ACRE) * 1000) / 1000;
}
