// SECTION 6: HARD FALLBACK TEST
// This is a test hook that bypasses Supabase entirely
// If this returns data instantly, it confirms the issue is in the request layer

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { SubscriptionProperty } from "./useSubscriptions";
import { ProgramType } from "@/lib/pricing";

// Mock data that returns instantly
const mockSubscriptions: SubscriptionProperty[] = [
  {
    id: "mock-sub-1",
    subscriptionId: "sub_test_1",
    address: "Service Location",
    zip: "",
    acreage: 0.25,
    plan: "Standard",
    program: "subscription" as ProgramType,
    cadence: 30,
    price: 125,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
  },
  {
    id: "mock-sub-2",
    subscriptionId: "sub_test_2",
    address: "Service Location",
    zip: "",
    acreage: 0.25,
    plan: "Premium",
    program: "subscription" as ProgramType,
    cadence: 14,
    price: 199,
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
  },
];

const fetchMockSubscriptions = async (): Promise<SubscriptionProperty[]> => {
  const startTime = performance.now();
  console.log("[useSubscriptionsTest] STARTING mock fetch (NO Supabase call)");
  
  // Simulate a tiny delay to let Promise settle
  await new Promise(resolve => setTimeout(resolve, 10));
  
  const elapsed = performance.now() - startTime;
  console.log(`[useSubscriptionsTest] ✓ Mock data returned in ${elapsed.toFixed(0)}ms (instant, no network)`);
  
  return mockSubscriptions;
};

/**
 * TEST HOOK: useSubscriptionsTest
 * 
 * This hook returns MOCK data with NO Supabase call.
 * If UI renders instantly with this hook, it proves the issue is in the Supabase request layer.
 * 
 * Usage: Replace useSubscriptions with useSubscriptionsTest in Billing.tsx temporarily
 * to test if the issue is requests hanging or something else.
 */
export const useSubscriptionsTest = (userId?: string) => {
  const { isHydrated } = useAuth();

  return useQuery({
    queryKey: ["subscriptions-test", userId],
    queryFn: () => fetchMockSubscriptions(),
    enabled: isHydrated && !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    placeholderData: (prev: SubscriptionProperty[] | undefined) => prev,
  });
};
