// Minimal ambient types for the subset of the Google Maps JavaScript API
// (Places library, legacy Autocomplete) used by GoogleAddressAutocomplete.
// Avoids depending on @types/google.maps for a handful of fields.
export {};

declare global {
  interface GooglePlaceAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
  }

  interface GooglePlaceResult {
    place_id?: string;
    formatted_address?: string;
    address_components?: GooglePlaceAddressComponent[];
    geometry?: {
      location?: {
        lat: () => number;
        lng: () => number;
      };
    };
  }

  interface GoogleAutocompleteInstance {
    addListener: (eventName: string, handler: () => void) => void;
    getPlace: () => GooglePlaceResult;
    setBounds: (bounds: unknown) => void;
  }

  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: {
              componentRestrictions?: { country: string | string[] };
              fields?: string[];
              types?: string[];
              bounds?: unknown;
            },
          ) => GoogleAutocompleteInstance;
        };
        LatLngBounds: new (
          sw?: { lat: number; lng: number },
          ne?: { lat: number; lng: number },
        ) => unknown;
        event: {
          clearInstanceListeners: (instance: unknown) => void;
        };
      };
    };
  }
}
