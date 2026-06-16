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

  interface GoogleMapOptions {
    center?: { lat: number; lng: number };
    zoom?: number;
    mapTypeId?: string;
    disableDefaultUI?: boolean;
    gestureHandling?: string;
    styles?: unknown[];
  }

  interface GoogleDataStyleOptions {
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeWeight?: number;
    strokeOpacity?: number;
  }

  interface GoogleDataFeature {
    getProperty: (name: string) => unknown;
  }

  interface GoogleDataMouseEvent {
    feature: GoogleDataFeature;
    latLng: GoogleLatLng;
  }

  interface GoogleDataLayer {
    addGeoJson: (geoJson: unknown) => unknown[];
    setStyle: (style: ((feature: GoogleDataFeature) => GoogleDataStyleOptions) | GoogleDataStyleOptions) => void;
    addListener: (event: string, handler: (e: GoogleDataMouseEvent) => void) => void;
    revertStyle: () => void;
    overrideStyle: (feature: GoogleDataFeature, style: GoogleDataStyleOptions) => void;
  }

  interface GoogleInfoWindow {
    setContent: (content: string) => void;
    setPosition: (latLng: GoogleLatLng) => void;
    open: (map: GoogleMap) => void;
    close: () => void;
  }

  interface GoogleMap {
    data: GoogleDataLayer;
    setCenter: (latLng: { lat: number; lng: number }) => void;
    setZoom: (zoom: number) => void;
    fitBounds: (bounds: unknown) => void;
  }

  interface Window {
    google?: {
      maps: {
        Map: new (element: HTMLElement, options?: GoogleMapOptions) => GoogleMap;
        InfoWindow: new (options?: { content?: string }) => GoogleInfoWindow;
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
