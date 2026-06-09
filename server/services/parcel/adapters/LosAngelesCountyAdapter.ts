import type { CountyParcelResult, NormalizedAddressInput } from "../types";
import type { CountyParcelAdapter } from "./BaseCountyAdapter";
import { buildArcgisPointQuery, parseArcgisFeature, fetchWithTimeout } from "./BaseCountyAdapter";

// LA County Assessor Parcel layer (confirmed working 2026-05, no auth required).
// Endpoint: cache.gis.lacounty.gov — public FeatureServer, polygon geometry.
// Shape__Area is in square feet (CA State Plane projection native units).
// Coverage: county-wide assessor data. Some incorporated cities (Burbank, Glendale,
// Pasadena, Long Beach) appear to maintain separate GIS and return no features here.
// When no feature is found the adapter returns null → MANUAL_REVIEW_REQUIRED (amber panel).
const BASE_URL = "https://cache.gis.lacounty.gov/cache/rest/services/LACounty_Cache/LACounty_Parcel/FeatureServer/0";
const OUT_FIELDS = "AIN,APN,SitusFullAddress,Shape__Area";

const ACREAGE_FIELDS: string[] = [];
const SQFT_FIELDS = ["Shape__Area"];  // native CA State Plane sq ft → ÷43560 = acres
const SQM_FIELDS: string[]  = [];
const APN_FIELDS = ["APN", "AIN"];

export const LosAngelesCountyAdapter: CountyParcelAdapter = {
  county: "los_angeles",

  async lookup(input: NormalizedAddressInput, timeoutMs = 8000): Promise<CountyParcelResult | null> {
    if (input.lat == null || input.lng == null) return null;

    const url = buildArcgisPointQuery(BASE_URL, input.lat, input.lng, OUT_FIELDS);

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

    return parseArcgisFeature(feature, ACREAGE_FIELDS, SQFT_FIELDS, SQM_FIELDS, APN_FIELDS, BASE_URL);
  },
};
