import type { CountyParcelResult, NormalizedAddressInput } from "../types";
import type { CountyParcelAdapter } from "./BaseCountyAdapter";
import { buildArcgisPointQuery, parseArcgisFeature, fetchWithTimeout } from "./BaseCountyAdapter";

// SCAG (Southern California Association of Governments) — regional land use layer.
// This is a land-use layer, not a parcel-boundary layer, so acreage is approximate.
// Confidence: medium (geometry-derived from land use polygon, not precise parcel boundary).

const BASE_URL = "https://rdp.scag.ca.gov/mapping/rest/services/Housing/2019_Annual_Land_Use_NAD83/MapServer/0";

const ACREAGE_FIELDS = ["ACREAGE", "ACRES", "AREA_ACRES", "LANDAREA"];
const SQFT_FIELDS    = ["AREA_SQFT", "SQFT"];
const SQM_FIELDS     = ["Shape.STArea()", "Shape_Area"];
const APN_FIELDS: string[] = [];

export const ScagFallbackAdapter: CountyParcelAdapter = {
  county: "unknown",

  async lookup(input: NormalizedAddressInput, timeoutMs = 4000): Promise<CountyParcelResult | null> {
    if (input.lat == null || input.lng == null) return null;

    const url = buildArcgisPointQuery(BASE_URL, input.lat, input.lng);

    let response: Response;
    try {
      response = await fetchWithTimeout(url, timeoutMs);
    } catch (err: any) {
      if (err?.name === "AbortError") throw new Error("PROVIDER_TIMEOUT");
      return null;
    }

    if (!response.ok) return null;

    const data = await response.json() as any;
    const feature = data?.features?.[0];
    if (!feature) return null;

    const result = parseArcgisFeature(feature, ACREAGE_FIELDS, SQFT_FIELDS, SQM_FIELDS, APN_FIELDS, BASE_URL);
    if (!result) return null;

    return {
      ...result,
      acreageSource: "scag_fallback",
      confidence: "low",
    };
  },
};
