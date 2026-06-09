import type { CountyParcelResult, NormalizedAddressInput } from "../types";
import type { CountyParcelAdapter } from "./BaseCountyAdapter";
import { fetchWithTimeout } from "./BaseCountyAdapter";
import { flags } from "../../../lib/featureFlags";

// Regrid is an optional last-resort fallback.
// Disabled by default — also controlled by ENABLE_REGRID_FALLBACK feature flag.
// Enable only if all county GIS + SCAG sources fail and a Regrid subscription
// covering the target geography is active.

const REGRID_API_KEY = process.env.REGRID_API_KEY?.trim();
const REGRID_BASE = "https://api.regrid.com/api/v2";

export const RegridFallbackAdapter: CountyParcelAdapter = {
  county: "unknown",

  async lookup(input: NormalizedAddressInput, timeoutMs = 4000): Promise<CountyParcelResult | null> {
    // Check both the legacy env var AND the new feature flag — both must be enabled
    if (!flags.regridFallback() || !REGRID_API_KEY) return null;

    const searchParts = [input.address];
    if (input.city)  searchParts.push(input.city);
    if (input.state) searchParts.push(input.state);
    searchParts.push(input.zip);
    const q = encodeURIComponent(searchParts.join(", "));

    const url = `${REGRID_BASE}/parcels?q=${q}&limit=1&token=${REGRID_API_KEY}`;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, timeoutMs);
    } catch (err: any) {
      if (err?.name === "AbortError") throw new Error("PROVIDER_TIMEOUT");
      return null;
    }

    if (!response.ok) return null;

    const data = await response.json() as any;
    const props = data?.features?.[0]?.properties;
    if (!props) return null;

    let acreage: number | null =
      props.acreage ?? props.parcel_acreage ?? props.calculated_acreage ?? null;
    if (acreage == null && props.lot_area_sqft) {
      acreage = Math.round((props.lot_area_sqft / 43560) * 1000) / 1000;
    }

    if (!acreage || acreage <= 0) return null;

    return {
      apn: props.apn ?? null,
      acreage,
      acreageSource: "regrid_fallback",
      geometry: null,
      confidence: "medium",
      sourceUrl: REGRID_BASE,
      rawPayload: props,
    };
  },
};
