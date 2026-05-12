import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";

declare global {
  namespace Express {
    interface Request {
      adminUserId?: string;
    }
  }
}

const createUserScopedSupabase = (token: string) =>
  createClient(process.env.VITE_SUPABASE_URL || "", process.env.VITE_SUPABASE_ANON_KEY || "", {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

const getRoleLookupClient = (token: string) => supabaseAdmin ?? createUserScopedSupabase(token);

/**
 * Middleware: requireAdmin
 * Validates Bearer token and confirms profiles.role === "admin".
 * Returns 401 for missing/invalid token, 403 for non-admin authenticated users.
 * Attaches adminUserId to req on success.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7);

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const roleLookupDb = getRoleLookupClient(token);

  const { data: profile, error: profileError } = await roleLookupDb
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }

  req.adminUserId = userData.user.id;
  next();
}

/**
 * Middleware: requireAdminOrEmployee
 * Allows access to users with role "admin" or "employee".
 * Returns 401 for missing/invalid token, 403 for customer-role users.
 */
export async function requireAdminOrEmployee(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7);

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const roleLookupDb = getRoleLookupClient(token);

  const { data: profile, error: profileError } = await roleLookupDb
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile || !["admin", "employee"].includes(profile.role)) {
    return res.status(403).json({ error: "Forbidden: admin or employee access required" });
  }

  req.adminUserId = userData.user.id;
  next();
}
