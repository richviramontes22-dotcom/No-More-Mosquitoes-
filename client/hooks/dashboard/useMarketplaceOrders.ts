import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchDashboardData } from "@/lib/dataFetch";
import { useAuth } from "@/contexts/AuthContext";

export interface MarketplaceOrder {
  id: string;
  user_id: string;
  appointment_id?: string;
  property_id?: string;
  stripe_session_id: string;
  total_cents: number;
  currency: string;
  status: string;
  fulfillment_status: string;
  confirmation_id: string;
  created_at: string;
  items?: MarketplaceOrderItem[];
}

export interface MarketplaceOrderItem {
  id: string;
  order_id: string;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

const fetchMarketplaceOrders = async (userId: string): Promise<MarketplaceOrder[]> => {
  const { data, error, isEmpty } = await fetchDashboardData(
    () =>
      supabase
        .from("marketplace_orders")
        .select("id, user_id, appointment_id, property_id, stripe_payment_intent_id, total_cents, subtotal_cents, tax_cents, currency, status, fulfillment_status, confirmation_id, created_at")
        .eq("user_id", userId)
        .in("status", ["pending", "completed"])
        .order("created_at", { ascending: false })
        .limit(20),
    "MarketplaceOrders"
  );

  if (error || isEmpty || !data) {
    return [];
  }

  // For each order, fetch its line items
  const ordersWithItems = await Promise.all(
    (data as any[]).map(async (order) => {
      const { data: items } = await supabase
        .from("marketplace_order_items")
        .select("id, order_id, item_name, quantity, unit_price_cents, line_total_cents")
        .eq("order_id", order.id);

      return {
        ...order,
        items: items || [],
      };
    })
  );

  return ordersWithItems as MarketplaceOrder[];
};

export const useMarketplaceOrders = (userId?: string) => {
  const { isHydrated } = useAuth();

  return useQuery({
    queryKey: ["marketplaceOrders", userId],
    queryFn: () => fetchMarketplaceOrders(userId || ""),
    enabled: isHydrated && !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    placeholderData: (previousData: any) => previousData,});
};

