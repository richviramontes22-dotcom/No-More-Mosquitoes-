import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

async function logAudit(
  actorId: string,
  actorRole: string,
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, any>
) {
  void db.from("onboarding_audit_log").insert({
    actor_id: actorId,
    actor_role: actorRole,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    metadata: metadata ?? null,
  });
}

// ── GET /api/admin/onboarding/forms ──────────────────────────────────────────
router.get("/onboarding/forms", requireAdmin, async (req, res) => {
  const adminId = (req as any).adminUserId;
  const { data, error } = await db
    .from("onboarding_forms")
    .select("id, name, description, category, form_type, required_for, required_roles, is_required, blocks_assignments, is_active, created_at")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Attach current version summary per form
  const formIds = (data || []).map((f: any) => f.id);
  let versionMap: Record<string, any> = {};
  if (formIds.length > 0) {
    const { data: versions } = await db
      .from("onboarding_form_versions")
      .select("id, form_id, version_number, title, is_current, effective_date")
      .in("form_id", formIds)
      .eq("is_current", true);
    (versions || []).forEach((v: any) => { versionMap[v.form_id] = v; });
  }

  return res.json({
    forms: (data || []).map((f: any) => ({ ...f, current_version: versionMap[f.id] ?? null }))
  });
});

// ── POST /api/admin/onboarding/forms ─────────────────────────────────────────
router.post("/onboarding/forms", requireAdmin, async (req, res) => {
  const adminId = (req as any).adminUserId;
  const { name, description, category, form_type, required_for, required_roles, is_required, blocks_assignments } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const { data, error } = await db
    .from("onboarding_forms")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      category: category || "custom",
      form_type: form_type || "acknowledgment",
      required_for: required_for || [],
      required_roles: required_roles || [],
      is_required: is_required !== false,
      blocks_assignments: blocks_assignments === true,
      created_by: adminId,
    })
    .select("id, name, category, form_type, is_active, created_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  logAudit(adminId, "admin", "form_created", "onboarding_form", data.id, { name: data.name });
  return res.json({ form: data });
});

// ── GET /api/admin/onboarding/forms/:id ─────────────────────────────────────
router.get("/onboarding/forms/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: form, error } = await db
    .from("onboarding_forms")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !form) return res.status(404).json({ error: "Form not found" });

  const { data: versions } = await db
    .from("onboarding_form_versions")
    .select("*")
    .eq("form_id", id)
    .order("version_number", { ascending: false });

  return res.json({ form, versions: versions || [] });
});

// ── PATCH /api/admin/onboarding/forms/:id ───────────────────────────────────
router.patch("/onboarding/forms/:id", requireAdmin, async (req, res) => {
  const adminId = (req as any).adminUserId;
  const { id } = req.params;
  const { name, description, category, form_type, required_for, required_roles, is_required, blocks_assignments } = req.body;

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name?.trim() || null;
  if (description !== undefined) updates.description = description?.trim() || null;
  if (category !== undefined) updates.category = category;
  if (form_type !== undefined) updates.form_type = form_type;
  if (required_for !== undefined) updates.required_for = required_for;
  if (required_roles !== undefined) updates.required_roles = required_roles;
  if (is_required !== undefined) updates.is_required = is_required;
  if (blocks_assignments !== undefined) updates.blocks_assignments = blocks_assignments;

  const { error } = await db.from("onboarding_forms").update(updates).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });

  logAudit(adminId, "admin", "form_updated", "onboarding_form", id);
  return res.json({ ok: true });
});

// ── POST /api/admin/onboarding/forms/:id/versions ───────────────────────────
router.post("/onboarding/forms/:id/versions", requireAdmin, async (req, res) => {
  const adminId = (req as any).adminUserId;
  const { id } = req.params;
  const { title, body_text, acknowledgment_statement, document_url, document_filename, effective_date } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  if (!acknowledgment_statement?.trim()) return res.status(400).json({ error: "acknowledgment_statement is required" });

  // Get next version number
  const { data: existing } = await db
    .from("onboarding_form_versions")
    .select("version_number")
    .eq("form_id", id)
    .order("version_number", { ascending: false })
    .limit(1);
  const nextVersion = ((existing?.[0] as any)?.version_number ?? 0) + 1;

  const { data, error } = await db
    .from("onboarding_form_versions")
    .insert({
      form_id: id,
      version_number: nextVersion,
      title: title.trim(),
      body_text: body_text?.trim() || null,
      acknowledgment_statement: acknowledgment_statement.trim(),
      document_url: document_url?.trim() || null,
      document_filename: document_filename?.trim() || null,
      effective_date: effective_date || new Date().toISOString().slice(0, 10),
      is_current: false,
      created_by: adminId,
    })
    .select("id, version_number, title, is_current, effective_date")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  logAudit(adminId, "admin", "version_created", "onboarding_form_version", data.id, { form_id: id, version: nextVersion });
  return res.json({ version: data });
});

// ── POST /api/admin/onboarding/forms/:id/activate-version ───────────────────
router.post("/onboarding/forms/:id/activate-version", requireAdmin, async (req, res) => {
  const adminId = (req as any).adminUserId;
  const { id } = req.params;
  const { version_id } = req.body;
  if (!version_id) return res.status(400).json({ error: "version_id required" });

  // Deactivate all current versions for this form
  await db.from("onboarding_form_versions").update({ is_current: false }).eq("form_id", id);

  // Activate the specified version
  const { error } = await db
    .from("onboarding_form_versions")
    .update({ is_current: true })
    .eq("id", version_id)
    .eq("form_id", id);

  if (error) return res.status(500).json({ error: error.message });

  logAudit(adminId, "admin", "version_activated", "onboarding_form_version", version_id, { form_id: id });
  return res.json({ ok: true });
});

// ── POST /api/admin/onboarding/forms/:id/deactivate ─────────────────────────
router.post("/onboarding/forms/:id/deactivate", requireAdmin, async (req, res) => {
  const adminId = (req as any).adminUserId;
  const { id } = req.params;
  const { error } = await db.from("onboarding_forms").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });

  logAudit(adminId, "admin", "form_deactivated", "onboarding_form", id);
  return res.json({ ok: true });
});

// ── GET /api/admin/onboarding/employees ─────────────────────────────────────
router.get("/onboarding/employees", requireAdmin, async (req, res) => {
  const { data: employees, error } = await db
    .from("employees")
    .select("id, user_id, role, worker_type, is_test, onboarding_status, onboarding_completed_at, onboarding_approved_at, status")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const userIds = (employees || []).map((e: any) => e.user_id).filter(Boolean);
  const profileMap: Record<string, { name: string; email: string }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await db.from("profiles").select("id, name, email").in("id", userIds);
    (profiles || []).forEach((p: any) => { profileMap[p.id] = { name: p.name, email: p.email }; });
  }

  // Get assignment counts
  const empIds = (employees || []).map((e: any) => e.id);
  const assignmentCounts: Record<string, { total: number; completed: number }> = {};
  if (empIds.length > 0) {
    const { data: assignments } = await db
      .from("employee_onboarding_assignments")
      .select("employee_id, status")
      .in("employee_id", empIds);
    (assignments || []).forEach((a: any) => {
      if (!assignmentCounts[a.employee_id]) assignmentCounts[a.employee_id] = { total: 0, completed: 0 };
      assignmentCounts[a.employee_id].total++;
      if (a.status === "completed") assignmentCounts[a.employee_id].completed++;
    });
  }

  return res.json({
    employees: (employees || []).map((e: any) => ({
      ...e,
      name: profileMap[e.user_id]?.name ?? "Unknown",
      email: profileMap[e.user_id]?.email ?? "",
      forms_total: assignmentCounts[e.id]?.total ?? 0,
      forms_completed: assignmentCounts[e.id]?.completed ?? 0,
    }))
  });
});

// ── GET /api/admin/onboarding/employees/:employeeId ──────────────────────────
router.get("/onboarding/employees/:employeeId", requireAdmin, async (req, res) => {
  const { employeeId } = req.params;
  const { data: assignments, error } = await db
    .from("employee_onboarding_assignments")
    .select("id, status, assigned_at, completed_at, form_id, form_version_id, onboarding_forms(name, category, form_type, is_required, blocks_assignments), onboarding_form_versions(title, version_number)")
    .eq("employee_id", employeeId)
    .order("assigned_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Get signatures
  const { data: sigs } = await db
    .from("employee_form_signatures")
    .select("form_version_id, signed_at, signature_text")
    .eq("employee_id", employeeId);
  const sigMap: Record<string, any> = {};
  (sigs || []).forEach((s: any) => { sigMap[s.form_version_id] = s; });

  // Get uploads
  const { data: uploads } = await db
    .from("employee_document_uploads")
    .select("id, form_id, document_type, filename, uploaded_at, review_status, review_notes")
    .eq("employee_id", employeeId);

  return res.json({
    assignments: (assignments || []).map((a: any) => ({
      ...a,
      signature: sigMap[a.form_version_id] ?? null,
    })),
    uploads: uploads || [],
  });
});

// ── POST /api/admin/onboarding/employees/:employeeId/assign ─────────────────
router.post("/onboarding/employees/:employeeId/assign", requireAdmin, async (req, res) => {
  const adminId = (req as any).adminUserId;
  const { employeeId } = req.params;
  const { form_version_id, due_date } = req.body;
  if (!form_version_id) return res.status(400).json({ error: "form_version_id required" });

  const { data: version } = await db
    .from("onboarding_form_versions")
    .select("id, form_id")
    .eq("id", form_version_id)
    .single();
  if (!version) return res.status(404).json({ error: "Form version not found" });

  // Check if already assigned
  const { data: existing } = await db
    .from("employee_onboarding_assignments")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("form_version_id", form_version_id)
    .maybeSingle();

  if (existing) return res.json({ ok: true, already_assigned: true });

  const { error } = await db.from("employee_onboarding_assignments").insert({
    employee_id: employeeId,
    form_id: (version as any).form_id,
    form_version_id,
    status: "pending",
    assigned_by: adminId,
    due_date: due_date || null,
  });

  if (error) return res.status(500).json({ error: error.message });

  logAudit(adminId, "admin", "form_assigned", "employee", employeeId, { form_version_id });
  return res.json({ ok: true });
});

// ── POST /api/admin/onboarding/documents/:uploadId/review ───────────────────
router.post("/onboarding/documents/:uploadId/review", requireAdmin, async (req, res) => {
  const adminId = (req as any).adminUserId;
  const { uploadId } = req.params;
  const { status, notes } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "status must be approved or rejected" });
  }

  const { data: upload, error } = await db
    .from("employee_document_uploads")
    .update({
      review_status: status,
      review_notes: notes?.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq("id", uploadId)
    .select("id, employee_id, assignment_id")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // If approved and linked to an assignment, mark assignment completed
  if (status === "approved" && (upload as any).assignment_id) {
    await db.from("employee_onboarding_assignments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", (upload as any).assignment_id);
  }

  logAudit(adminId, "admin", status === "approved" ? "document_approved" : "document_rejected",
    "employee_document_upload", uploadId, { employee_id: (upload as any).employee_id });
  return res.json({ ok: true });
});

// ── GET /api/admin/onboarding/export/signatures ──────────────────────────────
// CSV-ready signed record export
router.get("/onboarding/export/signatures", requireAdmin, async (req, res) => {
  const { form_id, employee_id } = req.query as Record<string, string>;

  let query = db
    .from("employee_form_signatures")
    .select("id, employee_id, form_id, form_version_id, signature_text, checkbox_acknowledged, acknowledgment_statement, ip_address, user_agent, signed_at");

  if (form_id) query = query.eq("form_id", form_id);
  if (employee_id) query = query.eq("employee_id", employee_id);

  const { data, error } = await query.order("signed_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ signatures: data || [] });
});

export default router;
