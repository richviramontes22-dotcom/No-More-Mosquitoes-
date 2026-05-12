import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Profile is optional, secondary data that enriches the base auth user.
 * This is NOT part of critical auth bootstrap.
 * Profile fetch failure does not affect auth readiness or dashboard rendering.
 */
export interface Profile {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  phone?: string;
  card_brand?: string;
  card_last4?: string;
  card_expiry?: string;
}

const fetchProfile = async (userId: string): Promise<Profile | null> => {
  if (!userId) {
    return null;
  }

  if (import.meta.env.DEV) console.log("[Profile] query started");

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, role, phone, card_brand, card_last4, card_expiry")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found - this is expected if profile row doesn't exist
        if (import.meta.env.DEV) console.log("[Profile] row missing");
        return null;
      }
      if (import.meta.env.DEV) console.log("[Profile] query error:", error.code);
      return null;
    }

    if (import.meta.env.DEV) console.log("[Profile] query success");
    return data as Profile;
  } catch (err) {
    if (import.meta.env.DEV) console.log("[Profile] query error:", err);
    return null;
  }
};

/**
 * useProfile - fetch optional profile data
 * This is independent of auth bootstrap and dashboard data loading.
 * If profile fetch fails or row is missing, dashboard still renders.
 */
export const useProfile = () => {
  const { user, isHydrated } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user?.id || ""),
    enabled: isHydrated && !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 0, // No retries for profile fetch
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
};

