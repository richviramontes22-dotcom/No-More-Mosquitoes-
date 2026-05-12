import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.warn("[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY not set — employee invite endpoint will return 501.");
}

// Service-role client: bypasses RLS, required for auth.admin operations.
// Never expose this client or its key to the browser.
export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl || "", serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
