import type { GeocodeResult } from "./types";

const GOOGLE_SERVER_KEY = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
const NOMINATIM_UA = "NMM-ParcelLookup/1.0 (nomoremosquitoes.us)";

// Matches a trailing unit/apartment/suite/building designator, e.g.
// ", Unit 31", " #31", " Apt 31", " Suite B" — with or without a leading comma.
const UNIT_SUFFIX_RE = /[\s,]+(?:#|unit|apt|apartment|suite|ste|bldg|building)\.?\s*#?\s*[a-z0-9][a-z0-9-]*\s*$/i;

/** Strip a trailing unit/apt/suite/building designator from a street address.
 *  Free geocoders (Nominatim) generally cannot resolve unit-level US
 *  addresses and return zero results when one is present — stripping it
 *  lets the underlying building/parcel still be located. The caller is
 *  responsible for preserving the original address for customer records. */
export function stripUnitSuffix(address: string): { stripped: string; hadUnit: boolean } {
  const match = address.match(UNIT_SUFFIX_RE);
  if (!match) return { stripped: address, hadUnit: false };
  return { stripped: address.slice(0, match.index).trim(), hadUnit: true };
}

/** Geocode an address to lat/lng + normalized address components.
 *  Prefers Google Geocoding API when key available; falls back to OSM
 *  Nominatim if Google is unavailable, errors, or returns no result. */
export async function geocodeAddress(
  address: string,
  zip: string,
  city?: string,
  state?: string,
  timeoutMs = 5000,
): Promise<GeocodeResult | null> {
  const fullQuery = [address, city, state, zip].filter(Boolean).join(", ");

  if (GOOGLE_SERVER_KEY) {
    const googleResult = await geocodeWithGoogle(fullQuery, timeoutMs);
    if (googleResult) return googleResult;
    // Google unavailable, errored, or had no result for this query —
    // fall through to Nominatim rather than failing the whole lookup.
  }
  return geocodeWithNominatim(fullQuery, timeoutMs);
}

async function geocodeWithGoogle(
  query: string,
  timeoutMs: number,
): Promise<GeocodeResult | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_SERVER_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data.status !== "OK" || !data.results?.length) return null;
    const result = data.results[0];
    const loc = result.geometry?.location;
    if (!loc) return null;

    const components: Record<string, string> = {};
    for (const c of result.address_components ?? []) {
      for (const t of c.types ?? []) {
        components[t] = c.short_name;
      }
    }

    return {
      lat: loc.lat,
      lng: loc.lng,
      normalizedAddress: result.formatted_address ?? query,
      city: components.locality ?? components.sublocality ?? undefined,
      state: components.administrative_area_level_1 ?? undefined,
      zip: components.postal_code ?? undefined,
      county: components.administrative_area_level_2?.replace(" County", "") ?? undefined,
      placeId: result.place_id ?? undefined,
      locationType: result.geometry?.location_type ?? undefined,
      source: "google",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function geocodeWithNominatim(
  query: string,
  timeoutMs: number,
): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=us&addressdetails=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": NOMINATIM_UA },
    });
    if (!res.ok) return null;
    const data = await res.json() as any[];
    if (!data?.length) return null;
    const r = data[0];
    const addr = r.address ?? {};
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      normalizedAddress: r.display_name ?? query,
      city: addr.city ?? addr.town ?? addr.village ?? undefined,
      state: addr.state ?? undefined,
      zip: addr.postcode ?? undefined,
      county: addr.county?.replace(" County", "") ?? undefined,
      source: "nominatim",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
