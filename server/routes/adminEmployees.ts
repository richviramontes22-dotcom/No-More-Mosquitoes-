import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function requireAdmin(req: any, res: any): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header." });
    return null;
  }
  const token = authHeader.substring(7);
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return null;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return null;
  }
  return userData.user.id;
}

// ─── GET /api/admin/employees ─────────────────────────────────────────────────
// Returns all employee records enriched with profile name + email.
router.get("/employees", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, user_id, role, phone, vehicle, default_nav, status, created_at")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const userIds = (employees || []).map((e: any) => e.user_id).filter(Boolean);
  const profileMap: Record<string, { name: string; email: string }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);
    (profiles || []).forEach((p: any) => {
      profileMap[p.id] = { name: p.name || "Unknown", email: p.email || "" };
    });
  }

  const result = (employees || []).map((e: any) => ({
    ...e,
    name: profileMap[e.user_id]?.name ?? "Unknown",
    email: profileMap[e.user_id]?.email ?? "",
  }));

  return res.json(result);
});

// ─── POST /api/admin/employees/invite ─────────────────────────────────────────
// Invites a new user by email and creates their profile + employee record.
router.post("/employees/invite", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  if (!supabaseAdmin) {
    return res.status(501).json({
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured on this server. Add it to your environment variables to enable employee invites.",
    });
  }

  const { name, email, role, phone, vehicle, default_nav } = req.body;

  if (!name?.trim() || !email?.trim() || !role) {
    return res.status(400).json({ error: "name, email, and role are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if a user with this email already exists
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    // User exists — check if they already have an employee record
    const { data: existingEmployee } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", existingProfile.id)
      .maybeSingle();

    if (existingEmployee) {
      return res.status(409).json({
        error: "An employee record already exists for this email address.",
      });
    }

    // User exists but no employee record — create one
    const { error: empError } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: existingProfile.id,
        role: role || "technician",
        phone: phone?.trim() || null,
        vehicle: vehicle?.trim() || null,
        default_nav: default_nav || "google",
        status: "active",
      });

    if (empError) return res.status(500).json({ error: empError.message });

    return res.json({
      success: true,
      existing: true,
      message: `Employee record created for existing user ${normalizedEmail}. They can log in at /employee/login.`,
    });
  }

  // New user — send Supabase invite email
  const appBase = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    normalizedEmail,
    {
      data: { name: name.trim(), role: "employee" },
      redirectTo: `${appBase}/employee`,
    }
  );

  if (inviteError) {
    return res.status(500).json({ error: inviteError.message });
  }

  const userId = inviteData.user.id;

  // Create profile row (service role bypasses RLS)
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      role: "employee",
    });

  // 23505 = unique violation — profile already created (race), safe to ignore
  if (profileError && profileError.code !== "23505") {
    console.error("[adminEmployees] Profile insert error:", profileError.message);
  }

  // Create employee row
  const { data: newEmployee, error: empError } = await supabaseAdmin
    .from("employees")
    .insert({
      user_id: userId,
      role: role || "technician",
      phone: phone?.trim() || null,
      vehicle: vehicle?.trim() || null,
      default_nav: default_nav || "google",
      status: "active",
    })
    .select("id")
    .single();

  if (empError) {
    return res.status(500).json({ error: empError.message });
  }

  return res.json({
    success: true,
    employeeId: newEmployee.id,
    message: `Invitation sent to ${normalizedEmail}. They'll receive an email with a link to set their password.`,
  });
});

// ─── PATCH /api/admin/employees/:id ──────────────────────────────────────────
// Updates an employee record (role, phone, vehicle, nav preference, status).
router.patch("/employees/:id", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { id } = req.params;
  const { role, phone, vehicle, default_nav, status } = req.body;

  const updates: Record<string, any> = {};
  if (role !== undefined) updates.role = role;
  if (phone !== undefined) updates.phone = phone?.trim() || null;
  if (vehicle !== undefined) updates.vehicle = vehicle?.trim() || null;
  if (default_nav !== undefined) updates.default_nav = default_nav;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  const { error } = await supabase
    .from("employees")
    .update(updates)
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true });
});

export default router;
