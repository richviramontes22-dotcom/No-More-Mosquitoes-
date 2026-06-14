import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGoogleMapsScript } from "@/lib/googleMapsLoader";
import { cn } from "@/lib/utils";

export type GoogleAddressAutocompleteResult = {
  formattedAddress: string;
  streetAddress: string;
  unit?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat: number;
  lng: number;
  placeId?: string;
};

// Bias (not restrict) results toward California — some supported service
// areas sit close to state borders.
const CA_BOUNDS = { south: 32.5121, west: -124.6509, north: 42.0095, east: -114.1315 };

const PLACE_FIELDS = ["id", "formattedAddress", "addressComponents", "location"];

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 200;

/** Parses a Google Place (new Places API, `place.fetchFields()` result) into
 *  our normalized shape. Returns null if the place has no location (nothing
 *  to fill in). */
export function parsePlaceResult(place: GooglePlace): GoogleAddressAutocompleteResult | null {
  const loc = place.location;
  if (!loc) return null;

  const components: Record<string, string> = {};
  for (const c of place.addressComponents ?? []) {
    for (const t of c.types ?? []) {
      components[t] = c.shortText;
    }
  }

  const streetAddress = [components.street_number, components.route].filter(Boolean).join(" ");

  return {
    formattedAddress: place.formattedAddress ?? streetAddress,
    streetAddress: streetAddress || place.formattedAddress || "",
    unit: components.subpremise || undefined,
    city: components.locality || components.sublocality || undefined,
    state: components.administrative_area_level_1 || undefined,
    zip: components.postal_code || undefined,
    lat: loc.lat(),
    lng: loc.lng(),
    placeId: place.id,
  };
}

/** Looks up the ZIP code for a lat/lng via the server's reverse-geocode
 *  endpoint. Returns null on any error or if no ZIP is found — callers
 *  should treat this as "couldn't backfill" rather than fail the selection. */
async function fetchZipForLocation(lat: number, lng: number): Promise<string | undefined> {
  try {
    const response = await fetch(`/api/parcel/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (!response.ok) return undefined;
    const body = (await response.json()) as { ok: boolean; zip?: string };
    return body.ok ? body.zip : undefined;
  } catch {
    return undefined;
  }
}

export interface GoogleAddressAutocompleteProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: GoogleAddressAutocompleteResult) => void;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
  error?: string;
  required?: boolean;
}

/** Street-address input with Google Places Autocomplete suggestions.
 *  Always renders as a plain, editable text input — if the Google Maps
 *  script isn't configured or fails to load, manual typing keeps working
 *  exactly as before. Suggestions are rendered in our own dropdown (the
 *  legacy `google.maps.places.Autocomplete` widget is unavailable for
 *  projects created after March 1, 2025, so we use the Autocomplete Data
 *  API + a custom list instead of Google's widget). */
export function GoogleAddressAutocomplete({
  id,
  label,
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  className,
  autoComplete = "off",
  error,
  required,
}: GoogleAddressAutocompleteProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const status = useGoogleMapsScript();

  // Keep the latest callbacks in refs so async suggestion handling always
  // calls the current onChange/onPlaceSelect without needing them as deps.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onPlaceSelectRef = useRef(onPlaceSelect);
  onPlaceSelectRef.current = onPlaceSelect;

  const [suggestions, setSuggestions] = useState<GoogleAutocompleteSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const sessionTokenRef = useRef<GoogleAutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Close the dropdown when clicking/tapping outside the input+list.
  useEffect(() => {
    if (suggestions.length === 0) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setSuggestions([]);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [suggestions.length]);

  const fetchSuggestions = (query: string) => {
    const places = window.google?.maps?.places;
    if (status !== "ready" || !places?.AutocompleteSuggestion) return;

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    }

    const requestId = ++requestIdRef.current;
    places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: query,
      sessionToken: sessionTokenRef.current,
      includedRegionCodes: ["us"],
      locationBias: CA_BOUNDS,
    })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setSuggestions(response.suggestions.filter((s) => s.placePrediction));
        setActiveIndex(-1);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setSuggestions([]);
        setActiveIndex(-1);
      });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(next), DEBOUNCE_MS);
  };

  const selectSuggestion = async (suggestion: GoogleAutocompleteSuggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;

    setSuggestions([]);
    setActiveIndex(-1);

    let place: GooglePlace;
    try {
      const response = await prediction.toPlace().fetchFields({ fields: PLACE_FIELDS });
      place = response.place;
    } catch {
      return;
    }

    // A place was selected — end this autocomplete session.
    sessionTokenRef.current = null;

    const result = parsePlaceResult(place);
    if (!result) return;

    // Route-level results (no house number) often have no postal_code —
    // a street can span multiple ZIPs. Reverse-geocoding the place's
    // lat/lng usually resolves to the nearest specific address, which
    // does have one.
    if (!result.zip) {
      const zip = await fetchZipForLocation(result.lat, result.lng);
      if (zip) result.zip = zip;
    }

    onChangeRef.current(result.streetAddress);
    onPlaceSelectRef.current(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        void selectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={inputId}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      <div ref={containerRef} className="relative">
        <Input
          id={inputId}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error}
          aria-describedby={errorId}
          aria-expanded={suggestions.length > 0}
          aria-autocomplete="list"
          role="combobox"
          className={className}
        />
        {suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            <ul role="listbox" className="max-h-60 overflow-auto py-1">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.placePrediction!.text.text + index}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none transition-colors",
                    index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void selectSuggestion(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {suggestion.placePrediction!.text.text}
                </li>
              ))}
            </ul>
            <div className="border-t px-3 py-1 text-right text-[10px] text-muted-foreground">Powered by Google</div>
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default GoogleAddressAutocomplete;
