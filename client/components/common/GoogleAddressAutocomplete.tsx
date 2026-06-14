import { useEffect, useId, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGoogleMapsScript } from "@/lib/googleMapsLoader";

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
const CA_BOUNDS_SW = { lat: 32.5121, lng: -124.6509 };
const CA_BOUNDS_NE = { lat: 42.0095, lng: -114.1315 };

const AUTOCOMPLETE_FIELDS = ["address_components", "formatted_address", "geometry", "place_id"];

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
 *  exactly as before. */
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
  const inputRef = useRef<HTMLInputElement>(null);
  const status = useGoogleMapsScript();

  useEffect(() => {
    const google = window.google;
    if (status !== "ready" || !inputRef.current || !google?.maps?.places) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      fields: AUTOCOMPLETE_FIELDS,
    });
    autocomplete.setBounds(new google.maps.LatLngBounds(CA_BOUNDS_SW, CA_BOUNDS_NE));

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;

      const components: Record<string, string> = {};
      for (const c of place.address_components ?? []) {
        for (const t of c.types ?? []) {
          components[t] = c.short_name;
        }
      }

      const streetAddress = [components.street_number, components.route].filter(Boolean).join(" ");

      const result: GoogleAddressAutocompleteResult = {
        formattedAddress: place.formatted_address ?? streetAddress,
        streetAddress: streetAddress || place.formatted_address || "",
        unit: components.subpremise || undefined,
        city: components.locality || components.sublocality || undefined,
        state: components.administrative_area_level_1 || undefined,
        zip: components.postal_code || undefined,
        lat: loc.lat(),
        lng: loc.lng(),
        placeId: place.place_id,
      };

      onChange(result.streetAddress);
      onPlaceSelect(result);
    });

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [status, onChange, onPlaceSelect]);

  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={inputId}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      <Input
        id={inputId}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className={className}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default GoogleAddressAutocomplete;
