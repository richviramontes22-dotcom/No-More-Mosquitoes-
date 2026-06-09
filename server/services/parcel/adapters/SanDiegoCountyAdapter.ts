import type { CountyParcelResult, NormalizedAddressInput } from "../types";
import type { CountyParcelAdapter } from "./BaseCountyAdapter";
import { buildArcgisPointQuery, parseArcgisFeature, fetchWithTimeout } from "./BaseCountyAdapter";

// SD County Assessor Parcels — polygon layer with APN + ACREAGE fields.
// Geometry rings are not returned by this MapServer even with returnGeometry=true,
// so acreage always comes from the ACREAGE attribute (county_field / high confidence).
const PARCEL_URL = "https://gis-public.sandiegocounty.gov/arcgis/rest/services/PDS/ISRP_PARCELS/MapServer/12";
const OUT_FIELDS = "APN,ACREAGE";

const ACREAGE_FIELDS = ["ACREAGE"];
const SQFT_FIELDS: string[]    = [];
const SQM_FIELDS: string[]     = [];
const APN_FIELDS     = ["APN"];

export const SanDiegoCountyAdapter: CountyParcelAdapter = {
  county: "san_diego",

  async lookup(input: NormalizedAddressInput, timeoutMs = 4000): Promise<CountyParcelResult | null> {
    if (input.lat == null || input.lng == null) return null;

    const url = buildArcgisPointQuery(PARCEL_URL, input.lat, input.lng, OUT_FIELDS);

    let response: Response;
    try {
      response = await fetchWithTimeout(url, timeoutMs);
    } catch (err: any) {
      if (err?.name === "AbortError") throw new Error("PROVIDER_TIMEOUT");
      throw err;
    }

    if (!response.ok) return null;

    const data = await response.json() as any;
    const feature = data?.features?.[0];
    if (!feature) return null;

    return parseArcgisFeature(feature, ACREAGE_FIELDS, SQFT_FIELDS, SQM_FIELDS, APN_FIELDS, PARCEL_URL);
  },
};
