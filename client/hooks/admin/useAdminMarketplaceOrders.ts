import { useState, useEffect, useMemo } from "react";
import { supabase, withTimeout } from "@/lib/supabase";

export interface AdminMarketplaceOrder {
  id: string;
  user_id: string;
  appointment_id?: string;
  stripe_session_id: string;
  total_cents: number;
  currency: string;
  status: string;
  fulfillment_status: string;
  confirmation_id: string;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  item_count?: number;
}

export const useAdminMarketplaceOrders = () => {
  const [orders, setOrders] = useState<AdminMarketplaceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setIsLoading(true);

        // Query marketplace orders with profile joins
        const { data: orderData, error } = await withTimeout(
          supabase
            .from("marketplace_orders")
            .select(`
              id,
              user_id,
              appointment_id,
              stripe_session_id,
              total_cents,
              currency,
              status,
              fulfillment_status,
              confirmation_id,
              created_at,
              profiles:user_id (id, name, email)
            `)
            .order("created_at", { ascending: false })
            .limit(50),
          10000,
          "Admin marketplace orders"
        );

        if (error) {
          console.error("[Admin Marketplace Orders] Query error:", {
            code: error.code,
            message: error.message,
          });
          setOrders([]);
          return;
        }

        if (!orderData) {
          setOrders([]);
          return;
        }

        // Get item counts for each order
        const ordersWithCounts = await Promise.all(
          (orderData as any[]).map(async (order) => {
            const { count } = await supabase
              .from("marketplace_order_items")
              .select("*", { count: "exact", head: true })
              .eq("order_id", order.id);

            return {
              id: order.id,
              user_id: order.user_id,
              appointment_id: order.appointment_id,
              stripe_session_id: order.stripe_session_id,
              total_cents: order.total_cents,
              currency: order.currency || "USD",
              status: order.status || "completed",
              fulfillment_status: order.fulfillment_status || "pending",
              confirmation_id: order.confirmation_id,
              created_at: order.created_at,
              customer_name: order.profiles?.name || "Unknown",
              customer_email: order.profiles?.email || "No email",
              item_count: count || 0,
            };
          })
        );

        setOrders(ordersWithCounts);
      } catch (err) {
        console.error("[Admin Marketplace Orders] Exception:", {
          message: err instanceof Error ? err.message : String(err),
        });
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrders();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (!q) return true;
      return (
        (order.customer_name || "").toLowerCase().includes(q) ||
        (order.customer_email || "").toLowerCase().includes(q) ||
        order.confirmation_id.toLowerCase().includes(q)
      );
    });
  }, [orders, searchQuery]);

  return {
    orders: filtered,
    allOrders: orders,
    isLoading,
    searchQuery,
    setSearchQuery,
  };
};
