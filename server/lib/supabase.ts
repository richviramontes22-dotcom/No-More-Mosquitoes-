import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Server: Supabase credentials missing.");
}

export const supabase = createClient(
  supabaseUrl || "",
  supabaseAnonKey || ""
);
