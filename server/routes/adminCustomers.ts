import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

/**
 * POST /api/admin/customers/invite
 * Invite a new customer via Supabase Auth admin invite.
 * Creates a profiles row with role=customer.
 */
router.post("/customers/invite", requireAdmin, async (req, res) => {
  const { email, name, phone } = req.body as {
    email?: string;
    name?: string;
    phone?: string;
  };

  if (!email || !name) {
    return res.status(400).json({ error: "email and name are required" });
  }

  const db = supabaseAdmin ?? supabase;

  // Send Supabase Auth invite email
  const { data: inviteData, error: inviteError } = await db.auth.admin.inviteUserByEmail(
    email.trim(),
    {
      data: { name: name.trim(), role: "customer" },
      redirectTo: `${process.env.SITE_URL || "https://nomoremosquitoes.us"}/login`,
    }
  );

  if (inviteError) {
    if (inviteError.message?.toLowerCase().includes("already registered")) {
      return res.status(409).json({ error: "A user with this email already exists." });
    }
    console.error("[Admin Customers] Invite error:", inviteError.message);
    return res.status(500).json({ error: inviteError.message });
  }

  const userId = inviteData?.user?.id;
  if (!userId) {
    return res.status(500).json({ error: "Invite succeeded but no user ID returned." });
  }

  // Upsert profile row
  const { error: profileError } = await db
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: email.trim(),
        name: name.trim(),
        phone: phone?.trim() || null,
        role: "customer",
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("[Admin Customers] Profile upsert error:", profileError.message);
    // Non-fatal — invite was sent, profile row may already exist or will be created on first login
  }

  res.json({
    success: true,
    userId,
    message: `Invite sent to ${email}. They will receive an email to set up their account.`,
  });
});

export default router;
