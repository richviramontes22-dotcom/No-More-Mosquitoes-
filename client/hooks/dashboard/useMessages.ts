import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchDashboardData } from "@/lib/dataFetch";
import { useAuth } from "@/contexts/AuthContext";

export interface Thread {
  id: string;
  lastActivityAt: string;
  address: string;
  jobId: string;
  lastMessage?: string;
}

interface MessageThreadRow {
  id: string;
  assignment_id: string;
  last_activity_at: string;
}

interface Assignment {
  id: string;
  appointment_id: string;
}

interface Appointment {
  id: string;
  property_id: string;
}

interface Property {
  id: string;
  address: string;
}

interface Message {
  thread_id: string;
  body: string;
  created_at: string;
}

const fetchMessages = async (userId: string): Promise<Thread[]> => {
  const { data: threads, error, isEmpty } = await fetchDashboardData(
    () =>
      supabase
        .from("message_threads")
        .select("id, assignment_id, last_activity_at, customer_visible")
        .eq("customer_visible", true)
        .order("last_activity_at", { ascending: false }),
    "Messages"
  );

  if (error || isEmpty || !threads) {
    return [];
  }

  return threads.map((t: MessageThreadRow) => ({
    id: t.id,
    lastActivityAt: t.last_activity_at,
    address: "Service Visit",  // Don't wait for appointment/property enrichment
    jobId: "N/A",  // Will be filled in by separate enrichment
    lastMessage: "No messages yet."  // Will be hydrated by separate query
  }));
};

export const useMessages = (userId?: string) => {
  // SECTION 4: Include auth readiness in enable condition
  const { isHydrated } = useAuth();

  return useQuery({
    queryKey: ["messages", userId],
    queryFn: () => fetchMessages(userId || ""),
    // Only execute query when auth is ready AND userId is available
    enabled: isHydrated && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 0, // Don't retry
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false, // Disable auto-refetch
    placeholderData: (previousData: any) => previousData,
  });
};

