import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "support" | "customer";

/**
 * Lightweight post-login role check
 * Fetches the canonical role from public.profiles with a short timeout
 * Falls back to "customer" if fetch fails or times out
 * This is used for post-login redirect decisions, not for blocking critical operations
 */
export async function fetchUserRoleForRedirect(userId: string, timeoutMs = 3000): Promise<UserRole> {
  if (!userId) {
    console.log("[PostLoginRole] No userId provided, defaulting to customer");
    return "customer";
  }

  try {
    console.log("[PostLoginRole] Starting role fetch with timeout:", timeoutMs);

    // Race the profile fetch against a timeout
    const result = await Promise.race([
      supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single(),
      new Promise<{ data: null; error: { code: string } }>((_, reject) =>
        setTimeout(() => reject(new Error(`[PostLoginRole] Fetch timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]) as any;

    // Check if Supabase returned an error (including RLS errors)
    if (result && result.error) {
      console.warn(`[PostLoginRole] Supabase error: ${result.error.code} - ${result.error.message || "unknown"}, defaulting to customer`);
      return "customer";
    }

    // Check if we got valid data
    if (!result || !result.data) {
      console.log("[PostLoginRole] No profile data returned, defaulting to customer");
      return "customer";
    }

    const role = (result.data.role || "customer") as UserRole;
    console.log("[PostLoginRole] ✓ Role resolved successfully:", role);
    return role;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const isTimeoutError = errorMsg.includes("timeout");
    const isNetworkError = errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError");

    if (isTimeoutError) {
      console.log(`[PostLoginRole] ⏱ Timeout after ${timeoutMs}ms, defaulting to customer`);
    } else if (isNetworkError) {
      console.log(`[PostLoginRole] ⚠ Network error, defaulting to customer: ${errorMsg}`);
    } else {
      console.log(`[PostLoginRole] ✗ Role check failed, defaulting to customer: ${errorMsg}`);
    }

    return "customer";
  }
}
