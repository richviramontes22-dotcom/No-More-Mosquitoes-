import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearReverseGeocodeCache,
  getCachedReverseGeocode,
  setCachedReverseGeocode,
} from "./reverseGeocodeCache";
import type { GeocodeResult } from "./types";

function result(zip: string): GeocodeResult {
  return {
    lat: 33.5267,
    lng: -117.7144,
    normalizedAddress: "Camino De Estrella, Dana Point, CA",
    city: "Dana Point",
    state: "CA",
    zip,
    county: "orange",
    source: "google",
  };
}

describe("reverseGeocodeCache", () => {
  beforeEach(() => {
    clearReverseGeocodeCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for coordinates that have never been cached", () => {
    expect(getCachedReverseGeocode(33.5267, -117.7144)).toBeNull();
  });

  it("returns a previously cached result for the same coordinates", () => {
    setCachedReverseGeocode(33.5267, -117.7144, result("92629"));
    expect(getCachedReverseGeocode(33.5267, -117.7144)).toEqual(result("92629"));
  });

  it("treats coordinates that round to the same grid cell as a cache hit", () => {
    setCachedReverseGeocode(33.52671234, -117.71449999, result("92629"));
    expect(getCachedReverseGeocode(33.5267, -117.7145)).toEqual(result("92629"));
  });

  it("treats distinct grid cells as separate entries", () => {
    setCachedReverseGeocode(33.5267, -117.7144, result("92629"));
    expect(getCachedReverseGeocode(34.0, -118.0)).toBeNull();
  });

  it("expires entries after the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T00:00:00Z"));

    setCachedReverseGeocode(33.5267, -117.7144, result("92629"));
    expect(getCachedReverseGeocode(33.5267, -117.7144)).not.toBeNull();

    vi.setSystemTime(new Date("2026-06-15T00:00:01Z")); // > 24h later
    expect(getCachedReverseGeocode(33.5267, -117.7144)).toBeNull();
  });

  it("evicts the oldest entry once the cache is full", () => {
    for (let i = 0; i < 1000; i++) {
      setCachedReverseGeocode(i, i, result(String(i)));
    }
    // First entry (0,0) is still present — cache not yet full.
    expect(getCachedReverseGeocode(0, 0)).not.toBeNull();

    // One more entry pushes the cache over MAX_ENTRIES, evicting (0,0).
    setCachedReverseGeocode(1000, 1000, result("1000"));
    expect(getCachedReverseGeocode(0, 0)).toBeNull();
    expect(getCachedReverseGeocode(1000, 1000)).not.toBeNull();
  });
});
