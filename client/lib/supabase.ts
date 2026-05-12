import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[Supabase] Credentials missing. Please check your environment variables.");
}

// Create a storage adapter that uses localStorage with fallback to memory
// This ensures sessions persist across page reloads (industry standard)
const createAuthStorage = () => {
  if (typeof window === "undefined") {
    // Server-side fallback - use in-memory storage
    const store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    };
  }

  // Client-side: use localStorage directly for proper persistence
  try {
    // Test if localStorage is available
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");

    return {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
        } catch (e) {
          console.warn("[Auth Storage] Failed to write to localStorage:", e);
        }
      },
      removeItem: (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn("[Auth Storage] Failed to remove from localStorage:", e);
        }
      },
    };
  } catch (e) {
    console.warn("[Auth Storage] localStorage not available, using fallback");
    // Fallback to in-memory storage if localStorage is not available
    const fallbackStore: Record<string, string> = {};
    return {
      getItem: (key: string) => fallbackStore[key] || null,
      setItem: (key: string, value: string) => {
        fallbackStore[key] = value;
      },
      removeItem: (key: string) => {
        delete fallbackStore[key];
      },
    };
  }
};

const authStorage = createAuthStorage();

// SECTION 1: Real timeout enforcement with Promise.race
// Rejects after timeoutMs if request is still pending
// Guarantees queries never hang forever
export const withTimeout = async <T,>(
  promise: PromiseLike<T> | T,
  timeoutMs = 10000, // Default 10 seconds
  label = "Request"
): Promise<T> => {
  // If it's a plain value, just return it immediately
  if (!promise || typeof promise !== 'object' || !('then' in promise)) {
    return promise as T;
  }

  const startTime = performance.now();

  // Create timeout promise that rejects after timeoutMs
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      const elapsed = performance.now() - startTime;
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
  });

  // Race: whichever completes first (request or timeout) wins
  return Promise.race([(promise as PromiseLike<T>), timeoutPromise])
    .then((result) => {
      return result;
    })
    .catch((error) => {
      const elapsed = performance.now() - startTime;
      if (error instanceof Error && error.message.includes("timed out")) {
        console.error(`[withTimeout] ${label} TIMED OUT after ${(timeoutMs / 1000).toFixed(1)}s`);
      } else {
        console.error(`[withTimeout] ${label} failed after ${elapsed.toFixed(2)}ms:`, error);
      }
      throw error;
    });
};

export const isTimeoutError = (error: unknown) =>
  error instanceof Error && /timed out after \d+ seconds\./i.test(error.message);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
    storageKey: "sb-auth-session"
  },
});
