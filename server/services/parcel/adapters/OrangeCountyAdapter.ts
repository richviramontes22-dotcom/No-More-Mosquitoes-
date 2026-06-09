import type { CountyParcelResult, NormalizedAddressInput } from "../types";
import type { CountyParcelAdapter } from "./BaseCountyAdapter";
import { buildArcgisPointQuery, parseArcgisFeature, fetchWithTimeout } from "./BaseCountyAdapter";

const BASE_URL = "https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0";
const SOURCE_URL = BASE_URL;

// OC GIS Parcels layer actual fields: OBJECTID, SITE_ADDRESS, ASSESSMENT_NO, SHAPE, YEAR_BUILT, NBR_BEDROOMS
// No acreage or sqft attributes — acreage always comes from geometry rings via @turf/area.
const ACREAGE_FIELDS: string[] = [];
const SQFT_FIELDS: string[]    = [];
const SQM_FIELDS: string[]     = [];
const APN_FIELDS                = ["ASSESSMENT_NO"];
const OUT_FIELDS                = "OBJECTID,SITE_ADDRESS,ASSESSMENT_NO";

export const OrangeCountyAdapter: CountyParcelAdapter = {
  county: "orange",

  async lookup(input: NormalizedAddressInput, timeoutMs = 4000): Promise<CountyParcelResult | null> {
    if (input.lat == null || input.lng == null) return null;

    const url = buildArcgisPointQuery(BASE_URL, input.lat, input.lng, OUT_FIELDS);

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

    return parseArcgisFeature(feature, ACREAGE_FIELDS, SQFT_FIELDS, SQM_FIELDS, APN_FIELDS, SOURCE_URL);
  },
};
