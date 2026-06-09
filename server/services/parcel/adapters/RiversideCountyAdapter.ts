import type { CountyParcelResult, NormalizedAddressInput } from "../types";
import type { CountyParcelAdapter } from "./BaseCountyAdapter";
import { buildArcgisPointQuery, parseArcgisFeature, fetchWithTimeout } from "./BaseCountyAdapter";

const BASE_URL = "https://gis.countyofriverside.us/arcgis_mapping/rest/services/Transportation/06_Parcels_Mapping_v2/MapServer/4";
const SOURCE_URL = BASE_URL;

const ACREAGE_FIELDS = ["ACREAGE", "ACRES", "CALC_ACRES", "NET_ACRES", "GIS_ACRES"];
const SQFT_FIELDS    = ["SQFT", "AREA_SQFT", "LOT_SQFT", "NET_SQFT"];
const SQM_FIELDS     = ["Shape.STArea()", "Shape_Area"];
const APN_FIELDS     = ["APN", "PARCEL", "PARCEL_NO", "APN_DASH", "ASSESSOR_NO"];

export const RiversideCountyAdapter: CountyParcelAdapter = {
  county: "riverside",

  async lookup(input: NormalizedAddressInput, timeoutMs = 4000): Promise<CountyParcelResult | null> {
    if (input.lat == null || input.lng == null) return null;

    const url = buildArcgisPointQuery(BASE_URL, input.lat, input.lng);

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
