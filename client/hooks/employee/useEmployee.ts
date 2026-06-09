import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface Employee {
  id: string;
  user_id: string;
  role: "technician" | "dispatcher" | "admin";
  worker_type: "employee" | "contractor" | "vendor" | "test";
  is_test: boolean;
  phone: string | null;
  vehicle: string | null;
  default_nav: "google" | "apple";
  status: "active" | "inactive";
  gps_consent_at: string | null;
  onboarding_status: "not_started" | "pending" | "in_progress" | "completed" | "approved";
  onboarding_completed_at: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
}

const fetchEmployee = async (userId: string): Promise<Employee | null> => {
  const { data, error } = await supabase
    .from("employees")
    .select("id, user_id, role, worker_type, is_test, phone, vehicle, default_nav, status, gps_consent_at, onboarding_status, onboarding_completed_at, emergency_contact_name, emergency_contact_phone, emergency_contact_relation")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data
    ? {
        ...data,
        worker_type: data.worker_type ?? "employee",
        is_test: data.is_test ?? false,
        gps_consent_at: data.gps_consent_at ?? null,
        onboarding_status: data.onboarding_status ?? "not_started",
        onboarding_completed_at: data.onboarding_completed_at ?? null,
        emergency_contact_name: data.emergency_contact_name ?? null,
        emergency_contact_phone: data.emergency_contact_phone ?? null,
        emergency_contact_relation: data.emergency_contact_relation ?? null,
      }
    : null;
};

export const useEmployee = () => {
  const { user, isHydrated } = useAuth();

  return useQuery({
    queryKey: ["employee", user?.id],
    queryFn: () => fetchEmployee(user!.id),
    enabled: isHydrated && !!user?.id,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });
};
