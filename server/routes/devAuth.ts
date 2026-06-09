/**
 * devAuth.ts — Developer-only auth utilities.
 *
 * ONLY mounted when NODE_ENV !== "production".
 * Never deployed to the live site.
 *
 * Provides:
 *   POST /api/dev/create-test-account
 *     Creates a @test.com account directly via the admin API.
 *     Never sends an email — bypasses Supabase's email rate limits entirely.
 *     Returns { success: true } so the client can sign in immediately.
 */

import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { supabase } from "../lib/supabase";

const router = Router();
const db = supabaseAdmin ?? supabase;

const TEST_SUFFIX = "@test.com";

function guardProd(res: any): boolean {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" });
    return true;
  }
  if (!supabaseAdmin) {
    res.status(501).json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" });
    return true;
  }
  return false;
}

/**
 * POST /api/dev/create-test-account
 *
 * Creates the Supabase auth user + profile in one server-side request
 * using the admin API. No email is sent — email_confirm is set to true
 * immediately, bypassing Supabase's SMTP rate limits entirely.
 *
 * Body: { firstName, lastName, email, phone, password }
 * Returns: { success: true, userId: string }
 */
router.post("/create-test-account", async (req, res) => {
  if (guardProd(res)) return;

  const { firstName, lastName, email, phone, password } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };

  if (!email || !email.toLowerCase().endsWith(TEST_SUFFIX)) {
    return res.status(400).json({ error: `Only ${TEST_SUFFIX} emails allowed on this endpoint` });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const first = (firstName ?? "").trim();
  const last  = (lastName  ?? "").trim();
  const displayName = [first, last].filter(Boolean).join(" ") || normalizedEmail.split("@")[0];

  // Check if this test account already exists — allow re-creation idempotently
  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existing?.id) {
    // Account already exists — update password so the caller can sign in
    const { error: pwErr } = await supabaseAdmin!.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (pwErr) return res.status(500).json({ error: pwErr.message });
    console.log(`[DevAuth] Re-used existing test account: ${normalizedEmail}`);
    return res.json({ success: true, userId: existing.id, reused: true });
  }

  // Create the Supabase auth user — email_confirm: true skips email entirely
  const { data: authData, error: createErr } = await supabaseAdmin!.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      name:       displayName,
      first_name: first,
      last_name:  last,
      role:       "customer",
    },
  });

  if (createErr) {
    console.error("[DevAuth] createUser failed:", createErr.message);
    return res.status(500).json({ error: createErr.message });
  }

  const userId = authData.user.id;

  // Upsert profile row — handles the race where the auth trigger already created
  // a profile row with role='customer' before this code runs (same 23505 bug as adminEmployees).
  const { error: profileErr } = await db.from("profiles").upsert(
    {
      id:         userId,
      name:       displayName,
      first_name: first,
      last_name:  last,
      email:      normalizedEmail,
      phone:      phone?.trim() || null,
      role:       "customer",
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    // Upsert failed — delete the auth user to keep state consistent
    await supabaseAdmin!.auth.admin.deleteUser(userId).catch(() => {});
    console.error("[DevAuth] Profile upsert failed:", profileErr.message);
    return res.status(500).json({ error: `Profile upsert failed: ${profileErr.message}` });
  }

  console.log(`[DevAuth] Test account created: ${normalizedEmail} (${userId})`);
  return res.json({ success: true, userId });
});

export default router;
