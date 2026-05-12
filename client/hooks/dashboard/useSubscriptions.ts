import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchDashboardData } from "@/lib/dataFetch";
import { calculatePricing, ProgramType } from "@/lib/pricing";
import { useAuth } from "@/contexts/AuthContext";

export interface SubscriptionProperty {
  id: string;
  subscriptionId?: string | null;
  address: string;
  zip: string;
  acreage: number;
  plan?: string;
  program?: ProgramType;
  cadence?: number;
  price?: number;
  status?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

type SubscriptionRow = {
  id: string;
  property_id: string | null;
  status: string;
  cadence_days: number | null;
  amount_cents: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

type PropertyRow = {
  id: string;
  address: string;
  zip: string;
  acreage: number;
  plan?: string | null;
  program?: string | null;
  cadence?: number | null;
  price?: number | null;
};

const fetchSubscriptions = async (userId: string): Promise<SubscriptionProperty[]> => {
  const { data: subscriptions, error, isEmpty } = await fetchDashboardData(
    () =>
      supabase
        .from("subscriptions")
        .select(`
          id,
          property_id,
          status,
          cadence_days,
          amount_cents,
          current_period_end,
          cancel_at_period_end,
          created_at
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    "Subscriptions"
  );

  if (error || isEmpty || !subscriptions) {
    return [];
  }

  const result: SubscriptionProperty[] = (subscriptions as SubscriptionRow[]).map((subscription) => {
    const acreage = 0.25;  // Default, not enriched
    const cadence = subscription.cadence_days || 30;
    const pricing = calculatePricing({
      acreage,
      program: "subscription",
      frequencyDays: cadence as any,
    });

    const priceFromSubscription = subscription.amount_cents != null ? subscription.amount_cents / 100 : null;

    return {
      id: subscription.property_id || subscription.id,  // Use property_id if available
      subscriptionId: subscription.id ?? null,
      address: "Service Location",  // Don't wait for property enrichment
      zip: "",  // Will be enriched separately
      acreage,
      plan: pricing.tierLabel || "Standard",
      program: (subscription.status === "active" ? "subscription" : "one_time") as ProgramType,
      cadence,
      price: priceFromSubscription ?? pricing.perVisit ?? 0,
      status: subscription.status ?? null,
      currentPeriodEnd: subscription.current_period_end ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    };
  });

  return result;
};

export const useSubscriptions = (userId?: string) => {
  // SECTION 4: Include auth readiness in enable condition
  const { isHydrated } = useAuth();

  return useQuery({
    queryKey: ["subscriptions", userId],
    queryFn: () => fetchSubscriptions(userId || ""),
    // Only execute query when auth is ready AND userId is available
    enabled: isHydrated && !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0, // Don't retry
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false, // Disable auto-refetch
    placeholderData: (previousData: any) => previousData,
  });
};

