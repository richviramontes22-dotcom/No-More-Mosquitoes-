import { useState, useCallback } from "react";
import { withTimeout } from "@/lib/supabase";

export type PropertyData = {
  acreage: number;
  sqft?: number;
  normalizedAddress?: string;
  county?: string;
  apn?: string | null;
  confidence?: "high" | "medium" | "low";
  acreageSource?: string;
  cached?: boolean;
  // Legacy fields — retained for backward compatibility with AddPropertyDialog
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export type ParcelQuoteResult = PropertyData & {
  quote?: {
    programs: {
      subscription: { cadenceOptions: { cadenceDays: number; label: string; cents: number }[]; defaultCadenceDays: number };
      one_time: { cents: number };
      annual: { cents: number | null };
    };
  };
  // True when the resolved parcel's acreage exceeds the priced range (e.g. a
  // condo/HOA shared parcel) — the caller should ask for a manual
  // unit/treatment-area size instead of rendering the quote tiles directly.
  oversized?: boolean;
  // True when the address's ZIP isn't an active service area — the caller
  // must NOT offer manual acreage entry or any path to checkout; show a
  // friendly "not in service area yet" message instead.
  outOfServiceArea?: boolean;
};

export const usePropertyLookup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ParcelQuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (
    address: string,
    zip: string,
    city?: string,
    state?: string,
    lat?: number,
    lng?: number,
    placeId?: string,
  ): Promise<ParcelQuoteResult | null> => {
    if (!address || !zip) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await withTimeout(
        fetch("/api/parcel/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, zip, city, state: state ?? "CA", lat, lng, placeId }),
        }),
        10000,
        "Property lookup",
      );

      const body = await response.json() as any;

      if (!response.ok || !body.ok) {
        const code = body.code ?? "UNKNOWN";
        if (code === "MANUAL_REVIEW_REQUIRED") {
          setError("manual_required");
        } else {
          setError(body.message ?? "Could not look up this address.");
        }
        return null;
      }

      const result: ParcelQuoteResult = {
        acreage: body.acreage,
        sqft: body.acreage != null ? Math.round(body.acreage * 43560) : undefined,
        normalizedAddress: body.normalizedAddress,
        county: body.county,
        apn: body.apn,
        confidence: body.confidence,
        acreageSource: body.acreageSource,
        cached: body.cached,
        quote: body.quote,
        oversized: body.oversized,
        outOfServiceArea: body.outOfServiceArea,
        // legacy compat
        address,
        city,
        state,
        zip,
      };

      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not look up this address.";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { lookup, clear, isLoading, data, error };
};
