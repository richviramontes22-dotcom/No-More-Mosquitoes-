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
  const { data: profile } = await (supabaseAdmin ?? supabase)
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

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─── GET /api/admin/employees ─────────────────────────────────────────────────
router.get("/employees", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, user_id, role, worker_type, is_test, phone, vehicle, default_nav, status, gps_consent_at, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, created_at")
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
    worker_type: e.worker_type ?? "employee",
    is_test: e.is_test ?? false,
    gps_consent_at: e.gps_consent_at ?? null,
    name: profileMap[e.user_id]?.name ?? "Unknown",
    email: profileMap[e.user_id]?.email ?? "",
  }));

  return res.json(result);
});

// ─── POST /api/admin/employees/invite ─────────────────────────────────────────
router.post("/employees/invite", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  if (!supabaseAdmin) {
    return res.status(501).json({
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to your environment variables to enable employee invites.",
    });
  }

  const {
    name, email, role, phone, vehicle, default_nav,
    worker_type, is_test, generate_temp_password,
  } = req.body;

  if (!name?.trim() || !email?.trim() || !role) {
    return res.status(400).json({ error: "name, email, and role are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const resolvedWorkerType = worker_type ?? "employee";
  const resolvedIsTest = Boolean(is_test);

  // Check if user already exists
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingProfile) {
    const { data: existingEmployee } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", existingProfile.id)
      .maybeSingle();

    if (existingEmployee) {
      return res.status(409).json({ error: "An employee record already exists for this email address." });
    }

    const { error: empError } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: existingProfile.id,
        role: role || "technician",
        worker_type: resolvedWorkerType,
        is_test: resolvedIsTest,
        phone: phone?.trim() || null,
        vehicle: vehicle?.trim() || null,
        default_nav: default_nav || "google",
        status: "active",
      });

    if (empError) return res.status(500).json({ error: empError.message });

    return res.json({
      success: true,
      existing: true,
      message: `Employee record created for existing user ${normalizedEmail}.`,
    });
  }

  const appBase = process.env.APP_BASE_URL || "https://nomoremosquitoes.us";
  let userId: string;
  let tempPassword: string | undefined;

  if (generate_temp_password && resolvedIsTest) {
    // Test employee with temp password — no invite email sent
    tempPassword = generateTempPassword();
    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: name.trim(), role: "employee" },
    });
    if (createErr) return res.status(500).json({ error: createErr.message });
    userId = createdUser.user.id;
  } else {
    // Normal invite — sends email
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: { name: name.trim(), role: "employee" },
        redirectTo: `${appBase}/employee`,
      }
    );
    if (inviteError) return res.status(500).json({ error: inviteError.message });
    userId = inviteData.user.id;
  }

  // Upsert profile row — handles the race where the auth trigger already created
  // a profile with role='customer' before this code runs (23505 silent-fail bug).
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: userId, name: name.trim(), email: normalizedEmail, role: "employee" },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("[adminEmployees] Profile upsert error:", profileError.message);
  }

  // Create employee row
  const { data: newEmployee, error: empError } = await supabaseAdmin
    .from("employees")
    .insert({
      user_id: userId,
      role: role || "technician",
      worker_type: resolvedWorkerType,
      is_test: resolvedIsTest,
      phone: phone?.trim() || null,
      vehicle: vehicle?.trim() || null,
      default_nav: default_nav || "google",
      status: "active",
    })
    .select("id")
    .single();

  if (empError) return res.status(500).json({ error: empError.message });

  // Auto-assign active onboarding forms matching this worker_type and role
  void (async () => {
    try {
      const { data: forms } = await supabaseAdmin
        .from("onboarding_forms")
        .select("id")
        .eq("is_active", true)
        .contains("required_for", [resolvedWorkerType]);

      if (!forms || forms.length === 0) return;

      // Find current active version per form
      const formIds = (forms as any[]).map((f) => f.id);
      const { data: versions } = await supabaseAdmin
        .from("onboarding_form_versions")
        .select("id, form_id")
        .in("form_id", formIds)
        .eq("is_current", true);

      if (!versions || versions.length === 0) return;

      const assignments = (versions as any[]).map((v) => ({
        employee_id: newEmployee.id,
        form_id: v.form_id,
        form_version_id: v.id,
        status: "pending",
        assigned_by: adminId,
      }));

      await supabaseAdmin.from("employee_onboarding_assignments").insert(assignments);

      // Set onboarding_status to pending
      await supabaseAdmin.from("employees")
        .update({ onboarding_status: "pending" })
        .eq("id", newEmployee.id);

      console.log(`[adminEmployees] Auto-assigned ${assignments.length} onboarding form(s) to employee ${newEmployee.id}`);
    } catch (autoErr: any) {
      console.error("[adminEmployees] Auto-assignment failed:", autoErr.message);
    }
  })();

  const response: Record<string, any> = {
    success: true,
    employeeId: newEmployee.id,
    is_test: resolvedIsTest,
    message: generate_temp_password && resolvedIsTest
      ? `Test employee created for ${normalizedEmail}. Use the temp password below — it will not be shown again.`
      : `Invitation sent to ${normalizedEmail}. They'll receive an email with a link to set their password.`,
  };

  if (tempPassword) {
    response.temp_password = tempPassword;
  }

  return res.json(response);
});

// ─── PATCH /api/admin/employees/:id ──────────────────────────────────────────
router.patch("/employees/:id", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { id } = req.params;
  const {
    role, phone, vehicle, default_nav, status,
    worker_type, is_test,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
  } = req.body;

  const updates: Record<string, any> = {};
  if (role !== undefined) updates.role = role;
  if (phone !== undefined) updates.phone = phone?.trim() || null;
  if (vehicle !== undefined) updates.vehicle = vehicle?.trim() || null;
  if (default_nav !== undefined) updates.default_nav = default_nav;
  if (status !== undefined) updates.status = status;
  if (worker_type !== undefined) updates.worker_type = worker_type;
  if (is_test !== undefined) updates.is_test = Boolean(is_test);
  if (emergency_contact_name !== undefined) updates.emergency_contact_name = emergency_contact_name?.trim() || null;
  if (emergency_contact_phone !== undefined) updates.emergency_contact_phone = emergency_contact_phone?.trim() || null;
  if (emergency_contact_relation !== undefined) updates.emergency_contact_relation = emergency_contact_relation?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update." });
  }

  const { error } = await (supabaseAdmin ?? supabase)
    .from("employees")
    .update(updates)
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true });
});

// ─── DELETE /api/admin/employees/:id ─────────────────────────────────────────
// Hard delete — only permitted for is_test = true employees.
router.delete("/employees/:id", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  if (!supabaseAdmin) {
    return res.status(501).json({ error: "SUPABASE_SERVICE_ROLE_KEY required for employee deletion." });
  }

  const { id } = req.params;
  const db = supabaseAdmin;

  // Verify employee exists and is a test account
  const { data: emp } = await db
    .from("employees")
    .select("id, user_id, is_test")
    .eq("id", id)
    .maybeSingle();

  if (!emp) return res.status(404).json({ error: "Employee not found." });
  if (!emp.is_test) {
    return res.status(403).json({
      error: "Real employees cannot be hard deleted. Use deactivation (PATCH status=inactive) instead.",
    });
  }

  // Nullify employee_id on assignments (ON DELETE SET NULL handles this, but be explicit)
  await db.from("assignments").update({ employee_id: null }).eq("employee_id", id);

  // Delete employee record (cascades: shifts, time_events, location_pings)
  const { error: empErr } = await db.from("employees").delete().eq("id", id);
  if (empErr) return res.status(500).json({ error: empErr.message });

  // Delete profile
  await db.from("profiles").delete().eq("id", emp.user_id);

  // Delete auth user
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(emp.user_id);
  if (authErr) {
    console.error("[adminEmployees] Auth user delete failed:", authErr.message);
    // Don't fail — employee and profile are already gone
  }

  console.log(`[adminEmployees] Test employee ${id} hard deleted by admin ${adminId}`);
  return res.json({ success: true, message: "Test employee deleted." });
});

export default router;
