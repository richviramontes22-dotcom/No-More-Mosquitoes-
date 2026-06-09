import type { CountyParcelResult, NormalizedAddressInput, SupportedCounty, GeoJsonPolygon, GeoJsonMultiPolygon } from "../types";
import { arcgisRingsToGeoJson, calculateAcreage, sqftToAcres, sqMetersToAcres } from "../geometry";

export interface CountyParcelAdapter {
  readonly county: SupportedCounty;
  lookup(input: NormalizedAddressInput, timeoutMs?: number): Promise<CountyParcelResult | null>;
}

/** Build an ArcGIS point-in-polygon query URL for any MapServer/FeatureServer layer. */
export function buildArcgisPointQuery(
  baseUrl: string,
  lat: number,
  lng: number,
  outFields = "*",
): string {
  const geom = encodeURIComponent(JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }));
  return (
    `${baseUrl}/query?geometry=${geom}` +
    `&geometryType=esriGeometryPoint` +
    `&spatialRel=esriSpatialRelIntersects` +
    `&outFields=${encodeURIComponent(outFields)}` +
    `&returnGeometry=true` +
    `&outSR=4326` +
    `&f=json`
  );
}

/** Parse an ArcGIS JSON response and extract acreage + GeoJSON geometry. */
export function parseArcgisFeature(
  feature: any,
  acreageFieldCandidates: string[],
  sqftFieldCandidates: string[],
  sqmFieldCandidates: string[],
  apnFieldCandidates: string[],
  sourceUrl: string,
): CountyParcelResult | null {
  if (!feature) return null;

  const props = feature.attributes ?? {};
  const geom  = feature.geometry;

  // APN
  const apn = apnFieldCandidates
    .map(f => props[f])
    .find(v => v != null && String(v).trim() !== "")
    ?.toString() ?? null;

  // Acreage from dedicated acreage field
  let acreage: number | null = null;
  let acreageSource: CountyParcelResult["acreageSource"] = "county_field";

  for (const field of acreageFieldCandidates) {
    const val = parseFloat(props[field]);
    if (isFinite(val) && val > 0 && val < 500) {
      acreage = Math.round(val * 1000) / 1000;
      break;
    }
  }

  // Convert from sqft if no acre field
  if (acreage == null) {
    for (const field of sqftFieldCandidates) {
      const val = parseFloat(props[field]);
      if (isFinite(val) && val > 0) {
        acreage = sqftToAcres(val);
        break;
      }
    }
  }

  // Convert from sq meters
  if (acreage == null) {
    for (const field of sqmFieldCandidates) {
      const val = parseFloat(props[field]);
      if (isFinite(val) && val > 0) {
        acreage = sqMetersToAcres(val);
        break;
      }
    }
  }

  // Calculate from geometry rings as last resort
  let geoJson: GeoJsonPolygon | GeoJsonMultiPolygon | null = null;
  if (geom?.rings) {
    geoJson = arcgisRingsToGeoJson(geom.rings);
    if (geoJson && acreage == null) {
      acreage = calculateAcreage(geoJson);
      acreageSource = "geometry_calculated";
    }
  }

  if (acreage == null) return null;

  return {
    apn,
    acreage,
    acreageSource,
    geometry: geoJson,
    confidence: acreageSource === "county_field" ? "high" : "medium",
    sourceUrl,
    rawPayload: feature,
  };
}

/** Fetch with abort controller timeout. */
export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { "Accept": "application/json" } });
  } finally {
    clearTimeout(timer);
  }
}
