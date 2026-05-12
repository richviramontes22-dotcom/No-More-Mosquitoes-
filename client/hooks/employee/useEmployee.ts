import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface Employee {
  id: string;
  user_id: string;
  role: "technician" | "dispatcher" | "admin";
  phone: string | null;
  vehicle: string | null;
  default_nav: "google" | "apple";
  status: "active" | "inactive";
}

const fetchEmployee = async (userId: string): Promise<Employee | null> => {
  const { data, error } = await supabase
    .from("employees")
    .select("id, user_id, role, phone, vehicle, default_nav, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data as Employee | null;
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

