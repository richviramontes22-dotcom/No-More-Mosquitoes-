import type { GeocodeResult } from "./types";

const GOOGLE_SERVER_KEY = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
const NOMINATIM_UA = "NMM-ParcelLookup/1.0 (nomoremosquitoes.us)";

/** Geocode an address to lat/lng + normalized address components.
 *  Prefers Google Geocoding API when key available; falls back to OSM Nominatim. */
export async function geocodeAddress(
  address: string,
  zip: string,
  city?: string,
  state?: string,
  timeoutMs = 5000,
): Promise<GeocodeResult | null> {
  const fullQuery = [address, city, state, zip].filter(Boolean).join(", ");

  if (GOOGLE_SERVER_KEY) {
    return geocodeWithGoogle(fullQuery, timeoutMs);
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
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
