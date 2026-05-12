import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchDashboardData } from "@/lib/dataFetch";
import { useAuth } from "@/contexts/AuthContext";

interface AppointmentRow {
  id: string;
  status: string;
  scheduled_at: string;
  notes?: string;
  property_id: string;
  service_type: string;
  frequency?: string;
}

/**
 * Appointment data shape with preserved real database ID.
 *
 * IMPORTANT: id is the real unique database identifier.
 * displayId is a shortened human-readable version for UI text only.
 * React keys MUST use raw id, never displayId.
 */
export interface Appointment {
  id: string; // Real database ID - NEVER overwrite this
  displayId: string; // Shortened ID for human display (e.g., first 8 chars)
  date: string;
  timeWindow: string;
  program: string;
  technician: string;
  status: string;
  address: string;
}

const fetchAppointments = async (userId: string): Promise<Appointment[]> => {
  const { data, error, isEmpty } = await fetchDashboardData(
    () =>
      supabase
        .from("appointments")
        .select("id, status, scheduled_at, notes, property_id, service_type, frequency")
        .eq("user_id", userId)
        .order("scheduled_at", { ascending: true }),
    "Appointments"
  );

  if (error || isEmpty || !data) {
    return [];
  }

  // Transform database rows to renderable Appointments
  // CRITICAL: Preserve real database ID, add separate displayId for UI
  const appointments = (data as AppointmentRow[]).map((app) => {
    const timeWindow = app.notes?.includes("Slot:")
      ? (app.notes.split("Slot:")[1] || "").split("|")[0]?.trim() || "TBD"
      : "TBD";

    // Extract shortened display ID from real ID (e.g., first 8 chars, uppercase)
    const displayId = String(app.id || "").substring(0, 8).toUpperCase() || "N/A";

    return {
      id: app.id, // IMPORTANT: Real database ID unchanged
      displayId: displayId, // Shortened version for UI text only
      date: app.scheduled_at,
      timeWindow,
      program: app.service_type || "Mosquito Service",
      technician: "Assigning...", // Don't wait for assignments
      status: (app.status || "requested").charAt(0).toUpperCase() + (app.status || "requested").slice(1),
      address: "Primary Property", // Don't wait for properties
    };
  });

  return appointments;
};

/**
 * useAppointments - fetch and return all appointments for the logged-in user.
 *
 * This hook:
 * - Depends only on auth readiness and stable user ID
 * - Uses the standardized shared fetch helper
 * - Preserves raw database IDs and provides separate displayIds
 * - Returns immediately renderable data
 * - Does not depend on other hooks or enrichment
 */
export const useAppointments = (userId?: string) => {
  const { isHydrated } = useAuth();

  return useQuery({
    queryKey: ["appointments", userId],
    queryFn: () => fetchAppointments(userId || ""),
    enabled: isHydrated && !!userId,
    retry: 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    placeholderData: (previousData: any) => previousData,});
};

