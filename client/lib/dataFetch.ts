import { supabase, withTimeout } from "./supabase";

/**
 * Standardized result shape for all dashboard data fetches.
 * This ensures consistent loading, empty, and error semantics across all hooks.
 */
export interface FetchResult<T> {
  data: T | null;
  isEmpty: boolean;
  error: Error | null;
  isLoading: false; // Loading is managed by React Query, not here
}

/**
 * Standardized dashboard data fetch strategy.
 * All dashboard hooks must use this helper.
 *
 * Benefits:
 * - Consistent timeout behavior (10 seconds for all queries)
 * - Consistent logging with error type detection
 * - Consistent error handling (including RLS errors from Supabase)
 * - Consistent empty/null result handling
 * - Prevents individual hooks from inventing ad hoc fetch semantics
 *
 * Known Limitation:
 * - Supabase RLS policy errors (e.g., infinite recursion) are returned as error objects
 *   and are handled gracefully as failed queries, not as broken state
 */
export async function fetchDashboardData<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  label: string,
  timeoutMs: number = 10000
): Promise<FetchResult<T>> {
  if (import.meta.env.DEV) console.log(`[DataFetch] ${label} started`);
  const startTime = performance.now();

  try {
    const result = await withTimeout(queryFn(), timeoutMs, label);
    const { data, error } = result;

    // Handle Supabase errors (including RLS errors)
    if (error) {
      const elapsed = performance.now() - startTime;
      const errorCode = error.code || "unknown";

      // Log error type for debugging RLS/network issues
      if (errorCode === "42P17") {
        if (import.meta.env.DEV) console.warn(`[DataFetch] ${label} RLS policy error after ${elapsed.toFixed(0)}ms (code: ${errorCode})`);
      } else if (errorCode.startsWith("PGRST")) {
        if (import.meta.env.DEV) console.warn(`[DataFetch] ${label} Supabase error after ${elapsed.toFixed(0)}ms (code: ${errorCode})`);
      } else {
        if (import.meta.env.DEV) console.log(`[DataFetch] ${label} error after ${elapsed.toFixed(0)}ms (code: ${errorCode})`);
      }

      return {
        data: null,
        isEmpty: false,
        error,
        isLoading: false,
      };
    }

    const elapsed = performance.now() - startTime;

    // Check if result is truly empty
    const isEmpty =
      data === null ||
      (Array.isArray(data) && data.length === 0);

    if (isEmpty) {
      if (import.meta.env.DEV) console.log(`[DataFetch] ${label} empty result after ${elapsed.toFixed(0)}ms`);
    } else {
      if (import.meta.env.DEV) console.log(`[DataFetch] ${label} success in ${elapsed.toFixed(0)}ms`);
    }

    return {
      data,
      isEmpty,
      error: null,
      isLoading: false,
    };
  } catch (err) {
    const elapsed = performance.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Log error type for debugging timeouts vs network errors
    if (errorMsg.includes("timed out")) {
      if (import.meta.env.DEV) console.warn(`[DataFetch] ${label} TIMEOUT after ${elapsed.toFixed(0)}ms`);
    } else if (errorMsg.includes("Failed to fetch")) {
      if (import.meta.env.DEV) console.warn(`[DataFetch] ${label} network error after ${elapsed.toFixed(0)}ms`);
    } else {
      if (import.meta.env.DEV) console.log(`[DataFetch] ${label} exception after ${elapsed.toFixed(0)}ms: ${errorMsg}`);
    }

    return {
      data: null,
      isEmpty: false,
      error: err instanceof Error ? err : new Error(String(err)),
      isLoading: false,
    };
  }
}

