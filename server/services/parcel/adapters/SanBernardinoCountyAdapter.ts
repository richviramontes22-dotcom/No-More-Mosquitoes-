import type { CountyParcelResult, NormalizedAddressInput } from "../types";
import type { CountyParcelAdapter } from "./BaseCountyAdapter";
import { buildArcgisPointQuery, parseArcgisFeature, fetchWithTimeout } from "./BaseCountyAdapter";

// San Bernardino County Assessor parcel layer via the county's open data ArcGIS portal.
// Endpoint: gisopendata.sbcounty.gov — public FeatureServer, no auth required.
// NET_ACRES / ACREAGE are dedicated acreage fields; Shape__Area (sq ft) is the fallback.
// Coverage: county-wide assessor data for all incorporated and unincorporated areas.
const BASE_URL = "https://gisopendata.sbcounty.gov/arcgis/rest/services/LIS/SBCo_Parcels/FeatureServer/0";
const OUT_FIELDS = "APN,PARCEL_NO,NET_ACRES,ACREAGE,GIS_ACRES,Shape__Area";

const ACREAGE_FIELDS = ["NET_ACRES", "ACREAGE", "GIS_ACRES"];
const SQFT_FIELDS    = ["Shape__Area"];
const SQM_FIELDS: string[] = [];
const APN_FIELDS     = ["APN", "PARCEL_NO"];

export const SanBernardinoCountyAdapter: CountyParcelAdapter = {
  county: "san_bernardino",

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
