import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { withTimeout } from "@/lib/supabase";

export type PropertyData = {
  acreage: number;
  sqft: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export const usePropertyLookup = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<PropertyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (address: string, zip: string, city?: string, state?: string) => {
    if (!address || !zip) {
      toast({
        title: "Missing details",
        description: "Please enter both address and ZIP code.",
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);
    setError(null);
    console.log(`Searching for address: ${address}, zip: ${zip}`);
    try {
      const response = await withTimeout(fetch("/api/regrid/parcel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, zip, city, state }),
      }), 10000, "Property lookup");

      if (!response.ok) {
        let errorMessage = "Failed to find parcel data";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error(`Regrid API error (JSON): ${JSON.stringify(errorData)}`);
        } catch (e) {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
          console.error(`Regrid API error (Text): ${errorText}`);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json() as { acreage: number; sqft: number };
      const propertyData: PropertyData = {
        ...result,
        address,
        zip,
        city,
        state
      };
      
      setData(propertyData);
      return propertyData;
    } catch (err) {
      const message = err instanceof Error ? err.message : "We couldn't locate that address.";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    lookup,
    clear,
    isLoading,
    data,
    error
  };
};
