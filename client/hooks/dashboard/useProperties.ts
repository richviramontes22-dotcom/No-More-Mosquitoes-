import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchDashboardData } from "@/lib/dataFetch";
import { useAuth } from "@/contexts/AuthContext";

export interface Property {
  id: string;
  address: string;
  zip: string;
  acreage: number;
  notes?: string;
  city?: string;
  state?: string;
  plan?: string;
  program?: string;
  cadence?: number;
  price?: number;
  is_default?: boolean;
}

const fetchProperties = async (userId: string): Promise<Property[]> => {
  const { data, error, isEmpty } = await fetchDashboardData(
    () =>
      supabase
        .from("properties")
        .select("id, address, zip, acreage, notes, city, state, plan, program, cadence, price, is_default, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    "Properties"
  );

  if (error || isEmpty || !data) {
    return [];
  }

  return (data as Property[]);
};

export const useProperties = (userId?: string) => {
  console.log("[useProperties Hook] Called with userId:", userId);

  // SECTION 4: Include auth readiness in enable condition
  const { isHydrated } = useAuth();

  return useQuery({
    queryKey: ["properties", userId],
    queryFn: () => {
      console.log("[useProperties queryFn] Executing with userId:", userId);
      return fetchProperties(userId || "");
    },
    // Only execute query when auth is ready AND userId is available
    enabled: isHydrated && !!userId,
    retry: 0, // Don't retry
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false, // Disable auto-refetch
    placeholderData: (previousData: any) => previousData,
  });
};

