// Minimal ambient types for the subset of the Google Maps JavaScript API
// (Places library, new Autocomplete Data API) used by GoogleAddressAutocomplete.
// Avoids depending on @types/google.maps for a handful of fields.
export {};

declare global {
  interface GooglePlaceAddressComponent {
    longText: string;
    shortText: string;
    types: string[];
  }

  interface GoogleLatLng {
    lat: () => number;
    lng: () => number;
  }

  interface GooglePlace {
    id?: string;
    formattedAddress?: string;
    addressComponents?: GooglePlaceAddressComponent[];
    location?: GoogleLatLng;
    fetchFields: (options: { fields: string[] }) => Promise<{ place: GooglePlace }>;
  }

  interface GooglePlacePrediction {
    text: { text: string };
    toPlace: () => GooglePlace;
  }

  interface GoogleAutocompleteSuggestion {
    placePrediction?: GooglePlacePrediction;
  }

  interface GoogleAutocompleteSessionToken {}

  interface Window {
    google?: {
      maps: {
        places: {
          AutocompleteSuggestion: {
            fetchAutocompleteSuggestions: (request: {
              input: string;
              sessionToken?: GoogleAutocompleteSessionToken;
              includedRegionCodes?: string[];
              locationBias?: unknown;
            }) => Promise<{ suggestions: GoogleAutocompleteSuggestion[] }>;
          };
          AutocompleteSessionToken: new () => GoogleAutocompleteSessionToken;
        };
      };
    };
  }
}
