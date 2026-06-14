import { describe, expect, it } from "vitest";

import { parsePlaceResult } from "./GoogleAddressAutocomplete";

function component(short_name: string, ...types: string[]): GooglePlaceAddressComponent {
  return { longText: short_name, shortText: short_name, types };
}

function latLng(lat: number, lng: number): GoogleLatLng {
  return { lat: () => lat, lng: () => lng };
}

describe("parsePlaceResult", () => {
  it("extracts street/city/state/zip/lat/lng/placeId from a full place result", () => {
    const place: GooglePlace = {
      id: "ChIJexample",
      formattedAddress: "11 Asilomar Rd, Laguna Niguel, CA 92677, USA",
      addressComponents: [
        component("11", "street_number"),
        component("Asilomar Rd", "route"),
        component("Laguna Niguel", "locality", "political"),
        component("CA", "administrative_area_level_1", "political"),
        component("92677", "postal_code"),
      ],
      location: latLng(33.5267, -117.7144),
      fetchFields: async () => ({ place: place }),
    };

    const result = parsePlaceResult(place);

    expect(result).toEqual({
      formattedAddress: "11 Asilomar Rd, Laguna Niguel, CA 92677, USA",
      streetAddress: "11 Asilomar Rd",
      unit: undefined,
      city: "Laguna Niguel",
      state: "CA",
      zip: "92677",
      lat: 33.5267,
      lng: -117.7144,
      placeId: "ChIJexample",
    });
  });

  it("includes the unit/apt from subpremise when present", () => {
    const place: GooglePlace = {
      id: "ChIJunit",
      formattedAddress: "22216 Caminito Escobedo Unit 31, Laguna Niguel, CA 92677, USA",
      addressComponents: [
        component("22216", "street_number"),
        component("Caminito Escobedo", "route"),
        component("31", "subpremise"),
        component("Laguna Niguel", "locality", "political"),
        component("CA", "administrative_area_level_1", "political"),
        component("92677", "postal_code"),
      ],
      location: latLng(33.52, -117.71),
      fetchFields: async () => ({ place: place }),
    };

    const result = parsePlaceResult(place);

    expect(result?.streetAddress).toBe("22216 Caminito Escobedo");
    expect(result?.unit).toBe("31");
  });

  it("falls back to sublocality when locality is absent", () => {
    const place: GooglePlace = {
      addressComponents: [
        component("123", "street_number"),
        component("Main St", "route"),
        component("Some Neighborhood", "sublocality", "political"),
        component("CA", "administrative_area_level_1", "political"),
        component("90210", "postal_code"),
      ],
      location: latLng(1, 2),
      fetchFields: async () => ({ place: place }),
    };

    expect(parsePlaceResult(place)?.city).toBe("Some Neighborhood");
  });

  it("falls back to formattedAddress for streetAddress when street_number/route are missing", () => {
    const place: GooglePlace = {
      formattedAddress: "Somewhere, CA, USA",
      addressComponents: [component("CA", "administrative_area_level_1", "political")],
      location: latLng(1, 2),
      fetchFields: async () => ({ place: place }),
    };

    expect(parsePlaceResult(place)?.streetAddress).toBe("Somewhere, CA, USA");
  });

  it("returns null when the place has no location", () => {
    const place: GooglePlace = {
      formattedAddress: "11 Asilomar Rd, Laguna Niguel, CA 92677, USA",
      addressComponents: [],
      fetchFields: async () => ({ place: place }),
    };

    expect(parsePlaceResult(place)).toBeNull();
  });
});
