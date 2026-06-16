import crypto from "crypto";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type { ParcelLookupResult, AcreageSource, Confidence, SupportedCounty } from "./types";

export function buildAddressHash(normalizedAddress: string): string {
  return crypto
    .createHash("sha256")
    .update(normalizedAddress.toLowerCase().trim())
    .digest("hex")
    .slice(0, 32);
}

/**
 * Canonical address hash for lead deduplication.
 *
 * Always hashes the raw, pre-geocode input fields (address, city, state, zip)
 * in a fixed order — NOT the post-geocode `normalizedAddress` returned by
 * Google. This guarantees the quote-success path, the manual-review path,
 * and the schedule-request path all produce the same hash for the same
 * submitted address, regardless of whether geocoding ran or succeeded.
 * See admin-crm-audit-reports/ADDRESS_HASH_STANDARDIZATION_REPORT.md.
 */
export function buildLeadAddressHash(
  address: string,
  city?: string | null,
  state?: string | null,
  zip?: string | null,
): string {
  const normalized = [address, city, state || "CA", zip]
    .map((part) => (part ?? "").toString().trim())
    .filter(Boolean)
    .join(", ");
  return buildAddressHash(normalized);
}

export type CacheRow = {
  normalized_address: string;
  address_hash: string;
  place_id?: string | null;
  county: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
  apn?: string | null;
  acreage: number;
  acreage_source: string;
  confidence: string;
  source_url?: string | null;
  raw_payload?: unknown;
  lookup_status: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  hit_count: number;
};

export async function getCachedParcel(
  addressHash: string,
  placeId?: string,
): Promise<ParcelLookupResult | null> {
  if (!supabaseAdmin) return null;

  let query = supabaseAdmin
    .from("parcel_lookup_cache")
    .select("*")
    .limit(1);

  if (placeId) {
    query = supabaseAdmin
      .from("parcel_lookup_cache")
      .select("*")
      .or(`address_hash.eq.${addressHash},place_id.eq.${placeId}`)
      .limit(1);
  } else {
    query = supabaseAdmin
      .from("parcel_lookup_cache")
      .select("*")
      .eq("address_hash", addressHash)
      .limit(1);
  }

  const { data, error } = await query.single();
  if (error || !data) return null;

  // Update access stats asynchronously — don't block the response.
  supabaseAdmin
    .from("parcel_lookup_cache")
    .update({
      last_accessed_at: new Date().toISOString(),
      hit_count: (data.hit_count ?? 1) + 1,
    })
    .eq("id", data.id)
    .then(() => {});

  return rowToResult(data);
}

export async function saveParcelToCache(
  params: {
    normalizedAddress: string;
    addressHash: string;
    placeId?: string | null;
    county: SupportedCounty;
    lat?: number | null;
    lng?: number | null;
    apn?: string | null;
    acreage: number;
    acreageSource: AcreageSource;
    confidence: Confidence;
    sourceUrl?: string | null;
    rawPayload?: unknown;
  },
): Promise<void> {
  if (!supabaseAdmin) return;

  const now = new Date().toISOString();
  await supabaseAdmin.from("parcel_lookup_cache").upsert(
    {
      normalized_address: params.normalizedAddress,
      address_hash: params.addressHash,
      place_id: params.placeId ?? null,
      county: params.county,
      state: "CA",
      latitude: params.lat ?? null,
      longitude: params.lng ?? null,
      apn: params.apn ?? null,
      acreage: params.acreage,
      acreage_source: params.acreageSource,
      confidence: params.confidence,
      source_url: params.sourceUrl ?? null,
      raw_payload: params.rawPayload ?? null,
      lookup_status: "success",
      created_at: now,
      updated_at: now,
      last_accessed_at: now,
      hit_count: 1,
    },
    { onConflict: "address_hash", ignoreDuplicates: false },
  );
}


function rowToResult(row: CacheRow): ParcelLookupResult {
  return {
    normalizedAddress: row.normalized_address,
    county: row.county as SupportedCounty,
    apn: row.apn ?? null,
    acreage: row.acreage,
    acreageSource: "cache" as AcreageSource,
    confidence: row.confidence as Confidence,
    sourceUrl: row.source_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
