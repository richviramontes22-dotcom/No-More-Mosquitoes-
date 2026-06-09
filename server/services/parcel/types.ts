export type SupportedCounty =
  | "orange"
  | "los_angeles"
  | "san_diego"
  | "riverside"
  | "unknown";

export type AcreageSource =
  | "cache"
  | "county_field"
  | "geometry_calculated"
  | "scag_fallback"
  | "regrid_fallback"
  | "manual_required";

export type Confidence = "high" | "medium" | "low";

export type ParcelLookupResult = {
  normalizedAddress: string;
  county: SupportedCounty;
  apn: string | null;
  acreage: number | null;
  acreageSource: AcreageSource;
  confidence: Confidence;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParcelErrorCode =
  | "UNSUPPORTED_COUNTY"
  | "COUNTY_LOOKUP_FAILED"
  | "GEOMETRY_CALCULATION_FAILED"
  | "MANUAL_REVIEW_REQUIRED"
  | "RATE_LIMITED"
  | "INVALID_ADDRESS"
  | "PROVIDER_TIMEOUT";

export type NormalizedAddressInput = {
  address: string;
  city?: string;
  state?: string;
  zip: string;
  lat?: number;
  lng?: number;
  placeId?: string;
};

export type GeocodeResult = {
  lat: number;
  lng: number;
  normalizedAddress: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
};

export type CountyParcelResult = {
  apn: string | null;
  acreage: number | null;
  acreageSource: Exclude<AcreageSource, "cache" | "manual_required">;
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon | null;
  confidence: Confidence;
  sourceUrl: string;
  rawPayload?: unknown;
};

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

export type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type PricingCadenceOption = {
  cadenceDays: number;
  label: string;
  cents: number;
};

export type PricingQuote = {
  programs: {
    subscription: {
      cadenceOptions: PricingCadenceOption[];
      defaultCadenceDays: number;
    };
    one_time: {
      cents: number;
    };
    annual: {
      cents: number | null;
    };
  };
};
