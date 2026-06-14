import type { GeocodeResult } from "./types";

// ZIP/city/county/state for a given coordinate are effectively static, so a
// generous TTL is safe. In-memory (not Supabase-backed) because this only
// needs to survive within a single warm server instance — the volume is low
// (only route-level Places selections with no postal_code) and a cold start
// just means the next lookup repopulates it.
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ENTRIES = 1000;

// Round to ~11m grid — Places returns the same lat/lng for a given place_id,
// so this mainly absorbs floating-point noise while still keying distinct
// nearby streets separately.
const PRECISION = 4;

interface CacheEntry {
  result: GeocodeResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function buildKey(lat: number, lng: number): string {
  return `${lat.toFixed(PRECISION)},${lng.toFixed(PRECISION)}`;
}

/** Returns the cached reverse-geocode result for these coordinates, or null
 *  if absent/expired. */
export function getCachedReverseGeocode(lat: number, lng: number): GeocodeResult | null {
  const key = buildKey(lat, lng);
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

/** Stores a reverse-geocode result for these coordinates, evicting the
 *  oldest entry if the cache is full. */
export function setCachedReverseGeocode(lat: number, lng: number, result: GeocodeResult): void {
  const key = buildKey(lat, lng);
  if (!cache.has(key) && cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { result, expiresAt: Date.now() + TTL_MS });
}

/** Test-only: clears all entries. */
export function clearReverseGeocodeCache(): void {
  cache.clear();
}
