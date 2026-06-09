import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "support" | "employee" | "customer";

export type PostLoginCheck = {
  role: UserRole;
  isOnboarded: boolean;
};

/**
 * Lightweight post-login role + onboarding check.
 * Fetches canonical role and is_onboarded from public.profiles with a short timeout.
 * Falls back to { role: "customer", isOnboarded: true } on failure so existing
 * users are never incorrectly sent to the onboarding flow.
 */
export async function fetchUserRoleForRedirect(
  userId: string,
  timeoutMs = 3000,
): Promise<PostLoginCheck> {
  if (!userId) {
    console.log("[PostLoginRole] No userId provided, defaulting to customer");
    return { role: "customer", isOnboarded: true };
  }

  try {
    console.log("[PostLoginRole] Starting role fetch with timeout:", timeoutMs);

    const result = await Promise.race([
      supabase
        .from("profiles")
        .select("role, is_onboarded")
        .eq("id", userId)
        .limit(1),
      new Promise<{ data: null; error: { code: string } }>((_, reject) =>
        setTimeout(
          () => reject(new Error(`[PostLoginRole] Fetch timeout after ${timeoutMs}ms`)),
          timeoutMs,
        )
      ),
    ]) as any;

    if (result && result.error) {
      console.warn(
        `[PostLoginRole] Supabase error: ${result.error.code} - ${result.error.message || "unknown"}, defaulting to customer`,
      );
      return { role: "customer", isOnboarded: true };
    }

    const profileRow = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (!profileRow) {
      console.log("[PostLoginRole] No profile data returned, defaulting to customer");
      return { role: "customer", isOnboarded: true };
    }

    const role = (profileRow.role || "customer") as UserRole;
    // is_onboarded: null/undefined → treat as true to avoid redirecting users
    // whose DB row predates the column (they were backfilled in the migration, but
    // defensive default here avoids edge cases).
    const isOnboarded = profileRow.is_onboarded !== false;
    console.log("[PostLoginRole] ✓ Role resolved:", role, "isOnboarded:", isOnboarded);
    return { role, isOnboarded };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const isTimeoutError  = errorMsg.includes("timeout");
    const isNetworkError  = errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError");

    if (isTimeoutError) {
      console.log(`[PostLoginRole] ⏱ Timeout after ${timeoutMs}ms, defaulting to customer`);
    } else if (isNetworkError) {
      console.log(`[PostLoginRole] ⚠ Network error, defaulting to customer: ${errorMsg}`);
    } else {
      console.log(`[PostLoginRole] ✗ Role check failed, defaulting to customer: ${errorMsg}`);
    }

    return { role: "customer", isOnboarded: true };
  }
}
