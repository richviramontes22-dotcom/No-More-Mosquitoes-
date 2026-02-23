import { createClient } from "@supabase/supabase-js";

// Hardcoded for testing to resolve "stuck" issue with environment variables
const supabaseUrl = "https://qamfxqbtvwwlzlmqrqbh.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbWZ4cWJ0dnd3bHpsbXFycWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTQ0NTIsImV4cCI6MjA4Mzg3MDQ1Mn0.sOxJSmYObHyyvlEBBiQPEPeowPq2MDJYxTt1oWi6o-s";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase credentials missing.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
