import { useQuery } from "@tanstack/react-query";
import { supabase, withTimeout } from "@/lib/supabase";

/**
 * FIX 3.1: Unified Supabase query hook
 * 
 * Replaces scattered Supabase query logic with a consistent pattern.
 * Provides built-in timeout protection, logging, and error handling.
 * 
 * Usage:
 * const { data: properties } = useSupabaseQuery<Property>("properties", {
 *   select: "id, address, zip, acreage",
 *   filters: [["user_id", userId]],
 *   order: ["created_at", "desc"],
 *   enabled: !!userId
 * });
 */

export interface UseSupabaseQueryConfig<T = any> {
  /** Comma-separated columns to select (e.g., "id, name, email") */
  select?: string;
  
  /** Array of [column, value] filters to apply (uses .eq()) */
  filters?: Array<[string, any]>;
  
  /** [column, direction] for ordering (direction: "asc" | "desc") */
  order?: [string, "asc" | "desc"];
  
  /** Max number of rows to fetch */
  limit?: number;
  
  /** Whether to run this query (default: true) */
  enabled?: boolean;
  
  /** Timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  
  /** Cache duration in milliseconds (default: 5 minutes) */
  staleTime?: number;
  
  /** Garbage collection time in milliseconds (default: 10 minutes) */
  gcTime?: number;
  
  /** Whether to retry on failure (default: 1) */
  retry?: number | boolean;
}

export function useSupabaseQuery<T = any>(
  table: string,
  config: UseSupabaseQueryConfig<T> = {},
  queryOptions: Record<string, unknown> = {}
) {
  const {
    select = "*",
    filters = [],
    order,
    limit,
    enabled = true,
    timeoutMs = 10000,
    staleTime = 5 * 60 * 1000,
    gcTime = 10 * 60 * 1000,
    retry = 1,
  } = config;

  return useQuery<T[], Error>({
    queryKey: [table, { select, filters, order, limit }],
    queryFn: async () => {
      console.log(`[useSupabaseQuery] Fetching from "${table}"`);
      const startTime = performance.now();

      try {
        let query = supabase.from(table).select(select || "*");

        // Apply filters
        filters?.forEach(([column, value]) => {
          query = query.eq(column, value);
        });

        // Apply ordering
        if (order) {
          query = query.order(order[0], { ascending: order[1] === "asc" });
        }

        // Apply limit
        if (limit) {
          query = query.limit(limit);
        }

        // Execute with timeout protection
        const { data, error } = await withTimeout(query, timeoutMs, table);

        if (error) {
          throw new Error(`${table} query failed: ${error.message}`);
        }

        const elapsed = performance.now() - startTime;
        console.log(`[useSupabaseQuery] "${table}" completed in ${elapsed.toFixed(2)}ms, got ${data?.length || 0} rows`);

        return (data || []) as T[];
      } catch (err) {
        const elapsed = performance.now() - startTime;
        console.error(`[useSupabaseQuery] "${table}" failed after ${elapsed.toFixed(2)}ms:`, err);
        throw err;
      }
    },
    enabled: !!enabled,
    retry: typeof retry === "boolean" ? (retry ? 1 : 0) : retry,
    staleTime,
    gcTime,
    ...queryOptions,
  });
}
