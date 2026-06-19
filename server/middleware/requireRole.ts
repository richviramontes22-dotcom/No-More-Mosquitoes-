import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";

declare global {
  namespace Express {
    interface Request {
      staffUserId?: string;
      staffRole?: string;
    }
  }
}

const createUserScopedSupabase = (token: string) =>
  createClient(process.env.VITE_SUPABASE_URL || "", process.env.VITE_SUPABASE_ANON_KEY || "", {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

const getRoleLookupClient = (token: string) => supabaseAdmin ?? createUserScopedSupabase(token);

/**
 * Factory for scoped staff-role middleware, modeled on requireAdmin
 * (server/middleware/requireAdmin.ts). Always allows 'admin' in addition to
 * the named role, so admins retain oversight access everywhere — but a
 * customer_service or sales profile can never satisfy requireAdmin itself,
 * so it can never reach admin-only endpoints (financials, employee
 * management, route automation settings, etc.). This is the actual
 * enforcement mechanism for "do not expose admin-only data to non-admin
 * roles" for these two new roles.
 */
function requireRole(allowedRole: string) {
  return async function (req: Request, res: Response, next: NextFunction) {
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

    if (profileError || !profile || !["admin", allowedRole].includes(profile.role)) {
      return res.status(403).json({ error: `Forbidden: ${allowedRole} or admin access required` });
    }

    req.staffUserId = userData.user.id;
    req.staffRole = profile.role;
    next();
  };
}

export const requireCustomerService = requireRole("customer_service");
export const requireSales = requireRole("sales");
