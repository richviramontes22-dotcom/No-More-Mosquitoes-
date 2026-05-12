import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchDashboardData } from "@/lib/dataFetch";
import { useAuth } from "@/contexts/AuthContext";

export interface UpcomingVisit {
  id: string;
  date: string;
  timeWindow: string;
  program: string;
  technician: string;
  status: string;
}

export interface RecentVideo {
  id: string;
  recordedAt: string;
  summary: string;
  url: string;
}

export interface DashboardData {
  upcomingVisits: UpcomingVisit[];
  recentVideos: RecentVideo[];
}

const getDashboardData = async (userId: string): Promise<DashboardData> => {
  // Safety check: userId must be non-empty
  if (!userId || userId.trim() === "") {
    if (import.meta.env.DEV) console.log("[DashboardData] No valid userId provided, returning empty data");
    return { upcomingVisits: [], recentVideos: [] };
  }

  const { data, error, isEmpty } = await fetchDashboardData(
    () =>
      supabase
        .from("appointments")
        .select("id, status, scheduled_at, notes, property_id, service_type")
        .eq("user_id", userId)
        .in("status", ["requested", "scheduled"])
        .order("scheduled_at", { ascending: true })
        .limit(2),
    "Dashboard appointments"
  );

  // Handle all failure cases gracefully
  if (error) {
    console.warn(`[DashboardData] Fetch error, returning empty data:`, error.message);
    return { upcomingVisits: [], recentVideos: [] };
  }

  if (isEmpty || !data) {
    if (import.meta.env.DEV) console.log("[DashboardData] No appointments found");
    return { upcomingVisits: [], recentVideos: [] };
  }

  // Safety check: ensure data is an array
  if (!Array.isArray(data)) {
    console.warn("[DashboardData] Unexpected data format, returning empty data");
    return { upcomingVisits: [], recentVideos: [] };
  }

  // Transform to renderable appointments for dashboard summary
  const upcomingVisits = data.map(app => {
    // Safely extract appointment fields with defaults
    const id = app.id || "";
    const status = app.status || "scheduled";
    const scheduled_at = app.scheduled_at || new Date().toISOString();
    const notes = app.notes || "";
    const service_type = app.service_type || "Mosquito Service";

    return {
      id,
      date: scheduled_at,
      timeWindow: notes.includes("Slot:") ? (notes.split("Slot:")[1] || "").split("|")[0]?.trim() || "TBD" : "TBD",
      program: service_type,
      technician: "Assigning...",
      status: status.charAt(0).toUpperCase() + status.slice(1),
    };
  });

  return { upcomingVisits, recentVideos: [] };
};

export const useDashboardData = (userId?: string) => {
  const { isHydrated } = useAuth();

  return useQuery({
    queryKey: ["dashboardData", userId],
    queryFn: () => getDashboardData(userId || ""),
    enabled: isHydrated && !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    placeholderData: (previousData: any) => previousData,});
};

