import { createClient } from "@supabase/supabase-js";

// Prioritize environment variables, fallback to hardcoded for local dev safety
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://qamfxqbtvwwlzlmqrqbh.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbWZ4cWJ0dnd3bHpsbXFycWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTQ0NTIsImV4cCI6MjA4Mzg3MDQ1Mn0.sOxJSmYObHyyvlEBBiQPEPeowPq2MDJYxTt1oWi6o-s";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase credentials missing. Please check your environment variables.");
} else {
  // Safe logging of initialization (no secret key revealed)
  console.log(`[Supabase] Initializing with URL: ${supabaseUrl}`);
}

// Create the client with some default options for better reliability
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: (url: string | Request, init?: RequestInit) => {
      return fetch(url, init).catch(err => {
        console.error("Supabase fetch failed:", err);
        throw err;
      });
    }
  }
});
