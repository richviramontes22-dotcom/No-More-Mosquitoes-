import type { ParcelLookupResult, SupportedCounty, NormalizedAddressInput, ParcelErrorCode } from "./types";
import { geocodeAddress } from "./googleAddressService";
import { detectCountyFromZip } from "./countyDetector";
import { logger } from "../../lib/logger";
import { checkpoint, CP } from "../../lib/checkpoint";
import { flags } from "../../lib/featureFlags";
import { captureException } from "../../lib/sentry";
import { randomUUID } from "crypto";
import { getCachedParcel, saveParcelToCache, buildAddressHash } from "./cache";
import { OrangeCountyAdapter } from "./adapters/OrangeCountyAdapter";
import { RiversideCountyAdapter } from "./adapters/RiversideCountyAdapter";
import { SanDiegoCountyAdapter } from "./adapters/SanDiegoCountyAdapter";
import { LosAngelesCountyAdapter } from "./adapters/LosAngelesCountyAdapter";
import type { CountyParcelAdapter } from "./adapters/BaseCountyAdapter";

// Active county adapters only — SCAG and Regrid are not in this chain.
const ADAPTER_MAP: Record<SupportedCounty, CountyParcelAdapter | null> = {
  orange:      OrangeCountyAdapter,
  riverside:   RiversideCountyAdapter,
  san_diego:   SanDiegoCountyAdapter,
  los_angeles: LosAngelesCountyAdapter, // returns null if no stable public endpoint
  unknown:     null,
};

const ADAPTER_TIMEOUT_MS = parseInt(process.env.COUNTY_ADAPTER_TIMEOUT_MS ?? "8000", 10);

export type ParcelLookupSuccess = ParcelLookupResult & { cached: boolean };
export type ParcelLookupError   = { errorCode: ParcelErrorCode; message: string };
export type ParcelLookupOutcome = ParcelLookupSuccess | ParcelLookupError;

export function isError(r: ParcelLookupOutcome): r is ParcelLookupError {
  return "errorCode" in r;
}

// In-flight map prevents hammering county GIS for identical concurrent requests.
const inFlight = new Map<string, Promise<ParcelLookupOutcome>>();

export async function lookupParcel(input: NormalizedAddressInput, requestId?: string): Promise<ParcelLookupOutcome> {
  const reqId = requestId || randomUUID();
  const start = Date.now();

  if (!input.address?.trim() || !input.zip?.trim()) {
    return { errorCode: "INVALID_ADDRESS", message: "Street address and ZIP code are required." };
  }

  checkpoint(reqId, CP.PARCEL_START, { zip: input.zip, hasCoords: input.lat != null });
  logger.info("parcel.lookup.started", { requestId: reqId, zip: input.zip, hasCoords: input.lat != null });

  const normalizedForHash = [
    input.address.trim(),
    input.city?.trim(),
    input.state?.trim() ?? "CA",
    input.zip.trim(),
  ].filter(Boolean).join(", ");

  const addressHash = buildAddressHash(normalizedForHash);

  const existing = inFlight.get(addressHash);
  if (existing) return existing;

  const promise = runLookup(input, normalizedForHash, addressHash, reqId, start);
  inFlight.set(addressHash, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(addressHash);
  }
}

async function runLookup(
  input: NormalizedAddressInput,
  normalizedForHash: string,
  addressHash: string,
  requestId: string,
  startMs: number,
): Promise<ParcelLookupOutcome> {

  // 1. Cache check
  checkpoint(requestId, CP.PARCEL_CACHE_CHECKED, { zip: input.zip });
  const cached = await getCachedParcel(addressHash, input.placeId);
  if (cached) {
    const durationMs = Date.now() - startMs;
    checkpoint(requestId, CP.PARCEL_CACHE_HIT, { county: cached.county, acreageSource: "cache", durationMs });
    logger.info("parcel.lookup.cache_hit", { requestId, county: cached.county, durationMs, cached: true });
    return { ...cached, acreageSource: "cache", cached: true };
  }
  checkpoint(requestId, CP.PARCEL_CACHE_MISS, { zip: input.zip });

  // Phase D: Feature flag gate — if county lookup is disabled, require manual review
  // (cache hit above still works even when flag is off)
  if (!flags.parcelCountyLookup()) {
    checkpoint(requestId, CP.PARCEL_COUNTY_DISABLED, { zip: input.zip });
    checkpoint(requestId, CP.PARCEL_MANUAL_REVIEW, { reason: "county_lookup_disabled" });
    logger.warn("parcel.lookup.county_lookup_disabled", { requestId, zip: input.zip });
    return {
      errorCode: "MANUAL_REVIEW_REQUIRED",
      message: "Automated lot size lookup is currently disabled. Our team will reach out with your quote.",
    };
  }

  // 2. Geocode to lat/lng if not provided by frontend
  let lat = input.lat;
  let lng = input.lng;
  let normalizedAddress = normalizedForHash;

  if (lat == null || lng == null) {
    const geo = await geocodeAddress(
      input.address,
      input.zip,
      input.city,
      input.state,
      5000,
    );
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      normalizedAddress = geo.normalizedAddress;
    }
  }

  // 3. Detect county
  const county = detectCountyFromZip(input.zip);
  checkpoint(requestId, CP.PARCEL_COUNTY_DETECTED, { county, zip: input.zip });

  // 4. Select and run county adapter
  const adapter = ADAPTER_MAP[county];
  if (!adapter || lat == null || lng == null) {
    checkpoint(requestId, CP.PARCEL_MANUAL_REVIEW, { reason: !adapter ? "unsupported_county" : "no_coords", county });
    logger.info("parcel.lookup.manual_review", { requestId, county, reason: !adapter ? "unsupported_county" : "no_coords" });
    return {
      errorCode: "MANUAL_REVIEW_REQUIRED",
      message: county === "unknown" || !adapter
        ? "This address is outside our supported service area. Contact us for a custom quote."
        : "We need your coordinates to look up this property. Please try again.",
    };
  }

  checkpoint(requestId, CP.PARCEL_COUNTY_LOOKUP_START, { county });
  let parcelResult = null;
  try {
    parcelResult = await adapter.lookup({ ...input, lat, lng }, ADAPTER_TIMEOUT_MS);
    if (parcelResult) {
      checkpoint(requestId, CP.PARCEL_COUNTY_LOOKUP_SUCCESS, { county, acreage: parcelResult.acreage, confidence: parcelResult.confidence });
    }
  } catch (err: any) {
    checkpoint(requestId, CP.PARCEL_COUNTY_LOOKUP_FAILED, { county, error: err?.message });
    logger.error("parcel.lookup.county_failed", err, { requestId, county });
    captureException(err, { requestId, tags: { flow: "parcel_lookup", county } });
  }

  if (!parcelResult || parcelResult.acreage == null) {
    checkpoint(requestId, CP.PARCEL_MANUAL_REVIEW, { reason: "no_parcel_result", county });
    logger.info("parcel.lookup.manual_review", { requestId, county, reason: "no_parcel_result" });
    return {
      errorCode: "MANUAL_REVIEW_REQUIRED",
      message: "We could not automatically verify the lot size for this address. Please enter it manually to get your quote.",
    };
  }

  // 5. Cache successful result
  const now = new Date().toISOString();
  await saveParcelToCache({
    normalizedAddress,
    addressHash,
    placeId: input.placeId ?? null,
    county,
    lat: lat ?? null,
    lng: lng ?? null,
    apn: parcelResult.apn ?? null,
    acreage: parcelResult.acreage,
    acreageSource: parcelResult.acreageSource,
    confidence: parcelResult.confidence,
    sourceUrl: parcelResult.sourceUrl ?? null,
    rawPayload: parcelResult.rawPayload ?? null,
  });

  const durationMs = Date.now() - startMs;
  logger.info("parcel.lookup.county_success", {
    requestId, county,
    acreageSource: parcelResult.acreageSource,
    confidence: parcelResult.confidence,
    cached: false, durationMs,
  });

  return {
    normalizedAddress,
    county,
    apn: parcelResult.apn ?? null,
    acreage: parcelResult.acreage,
    acreageSource: parcelResult.acreageSource,
    confidence: parcelResult.confidence,
    sourceUrl: parcelResult.sourceUrl ?? null,
    createdAt: now,
    updatedAt: now,
    cached: false,
  };
}
