import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

async function getAuthEmployee(req: any): Promise<{ userId: string; employeeId: string; isTest: boolean } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: emp } = await db
    .from("employees")
    .select("id, is_test")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!emp) return null;
  return { userId: user.id, employeeId: emp.id, isTest: emp.is_test ?? false };
}

async function logAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, any>
) {
  void db.from("onboarding_audit_log").insert({
    actor_id: actorId,
    actor_role: "employee",
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata ?? null,
  });
}

/**
 * GET /api/employee/onboarding
 * Returns all onboarding assignments for the authenticated employee,
 * enriched with form and version details.
 */
router.get("/onboarding", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { data: assignments, error } = await db
    .from("employee_onboarding_assignments")
    .select(`
      id, status, assigned_at, completed_at, due_date,
      form_id, form_version_id,
      onboarding_forms!inner (id, name, category, form_type, is_required, blocks_assignments),
      onboarding_form_versions!inner (id, title, version_number, acknowledgment_statement, document_url)
    `)
    .eq("employee_id", actor.employeeId)
    .order("assigned_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const versionIds = (assignments || []).map((a: any) => a.form_version_id);
  const sigMap: Record<string, boolean> = {};
  if (versionIds.length > 0) {
    const { data: sigs } = await db
      .from("employee_form_signatures")
      .select("form_version_id")
      .eq("employee_id", actor.employeeId)
      .in("form_version_id", versionIds);
    (sigs || []).forEach((s: any) => { sigMap[s.form_version_id] = true; });
  }

  const total = (assignments || []).length;
  const completed = (assignments || []).filter((a: any) => a.status === "completed").length;

  return res.json({
    assignments: assignments || [],
    signed_version_ids: sigMap,
    progress: { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 },
  });
});

/**
 * GET /api/employee/onboarding/:assignmentId
 * Returns full form content for one assignment.
 */
router.get("/onboarding/:assignmentId", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { assignmentId } = req.params;

  const { data: assignment, error } = await db
    .from("employee_onboarding_assignments")
    .select(`
      id, status, assigned_at, completed_at,
      form_id, form_version_id,
      onboarding_forms (id, name, category, form_type, is_required, blocks_assignments, description),
      onboarding_form_versions (id, title, version_number, body_text, acknowledgment_statement, document_url, document_filename)
    `)
    .eq("id", assignmentId)
    .eq("employee_id", actor.employeeId)
    .single();

  if (error || !assignment) return res.status(404).json({ error: "Assignment not found" });

  // Check if already signed
  const { data: existingSig } = await db
    .from("employee_form_signatures")
    .select("id, signed_at, signature_text")
    .eq("employee_id", actor.employeeId)
    .eq("form_version_id", (assignment as any).form_version_id)
    .maybeSingle();

  return res.json({ assignment, existing_signature: existingSig ?? null });
});

/**
 * POST /api/employee/onboarding/:assignmentId/sign
 * Submits an acknowledgment signature for a form assignment.
 * Captures server-side: timestamp, IP address, user agent.
 * Stores an immutable snapshot of the acknowledgment statement.
 */
router.post("/onboarding/:assignmentId/sign", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { assignmentId } = req.params;
  const { signature_text, checkbox_acknowledged } = req.body;

  if (!signature_text?.trim()) return res.status(400).json({ error: "signature_text (typed name) is required" });
  if (!checkbox_acknowledged) return res.status(400).json({ error: "checkbox_acknowledged must be true" });

  // Fetch the assignment (ownership check)
  const { data: assignment, error: fetchErr } = await db
    .from("employee_onboarding_assignments")
    .select("id, employee_id, form_id, form_version_id, status")
    .eq("id", assignmentId)
    .eq("employee_id", actor.employeeId)
    .single();

  if (fetchErr || !assignment) return res.status(404).json({ error: "Assignment not found" });
  if ((assignment as any).status === "completed") {
    return res.status(409).json({ error: "This form has already been signed." });
  }

  // Fetch the acknowledgment statement from the version (snapshot it)
  const { data: version } = await db
    .from("onboarding_form_versions")
    .select("acknowledgment_statement")
    .eq("id", (assignment as any).form_version_id)
    .single();

  const statementSnapshot = (version as any)?.acknowledgment_statement ?? "I acknowledge this document.";

  // Server-side capture — never trust client values
  const ipAddress = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ?? req.ip ?? null;
  const userAgent = req.headers["user-agent"] ?? null;
  const now = new Date().toISOString();

  // Insert immutable signature record
  const { error: sigErr } = await db.from("employee_form_signatures").insert({
    employee_id: actor.employeeId,
    user_id: actor.userId,
    form_id: (assignment as any).form_id,
    form_version_id: (assignment as any).form_version_id,
    assignment_id: assignmentId,
    signature_text: signature_text.trim(),
    checkbox_acknowledged: true,
    acknowledgment_statement: statementSnapshot,
    ip_address: ipAddress,
    user_agent: userAgent,
    signed_at: now,
  });

  if (sigErr) {
    if (sigErr.code === "23505") return res.status(409).json({ error: "Already signed." });
    return res.status(500).json({ error: sigErr.message });
  }

  // Mark assignment completed
  await db.from("employee_onboarding_assignments")
    .update({ status: "completed", completed_at: now })
    .eq("id", assignmentId);

  // If this is a GPS consent form, set gps_consent_at on the employee
  const { data: form } = await db
    .from("onboarding_forms")
    .select("category")
    .eq("id", (assignment as any).form_id)
    .maybeSingle();

  if ((form as any)?.category === "gps_consent") {
    await db.from("employees")
      .update({
        gps_consent_at: now,
        gps_consent_form_version_id: (assignment as any).form_version_id,
      })
      .eq("id", actor.employeeId);
    console.log(`[employeeOnboarding] GPS consent set via onboarding for employee ${actor.employeeId}`);
  }

  // Update employee onboarding_status
  await updateOnboardingStatus(actor.employeeId);

  logAudit(actor.userId, "form_signed", "employee_onboarding_assignment", assignmentId, {
    form_id: (assignment as any).form_id,
    is_gps_consent: (form as any)?.category === "gps_consent",
    is_test: actor.isTest,
  });

  return res.json({ ok: true, signed_at: now });
});

/**
 * POST /api/employee/onboarding/:assignmentId/upload
 * Uploads a document for a required-upload form.
 */
router.post("/onboarding/:assignmentId/upload", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { assignmentId } = req.params;
  const { document_url, filename, document_type, file_size_bytes } = req.body;

  if (!document_url?.trim()) return res.status(400).json({ error: "document_url is required" });

  // Verify assignment ownership
  const { data: assignment } = await db
    .from("employee_onboarding_assignments")
    .select("id, employee_id, form_id")
    .eq("id", assignmentId)
    .eq("employee_id", actor.employeeId)
    .single();

  if (!assignment) return res.status(404).json({ error: "Assignment not found" });

  const { data: upload, error } = await db.from("employee_document_uploads").insert({
    employee_id: actor.employeeId,
    assignment_id: assignmentId,
    form_id: (assignment as any).form_id,
    document_url: document_url.trim(),
    filename: filename?.trim() || null,
    document_type: document_type || "custom",
    file_size_bytes: file_size_bytes ?? null,
  }).select("id").single();

  if (error) return res.status(500).json({ error: error.message });

  logAudit(actor.userId, "document_uploaded", "employee_document_upload", (upload as any).id, {
    assignment_id: assignmentId,
    is_test: actor.isTest,
  });

  return res.json({ ok: true, upload_id: (upload as any).id });
});

/**
 * POST /api/employee/onboarding/consent/withdraw
 * Withdraws GPS consent — clears gps_consent_at on employee record.
 */
router.post("/onboarding/consent/withdraw", async (req, res) => {
  const actor = await getAuthEmployee(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  await db.from("employees")
    .update({ gps_consent_at: null, gps_consent_form_version_id: null })
    .eq("id", actor.employeeId);

  logAudit(actor.userId, "consent_withdrawn", "employee", actor.employeeId, {
    type: "gps_consent",
    is_test: actor.isTest,
  });

  console.log(`[employeeOnboarding] GPS consent withdrawn for employee ${actor.employeeId}`);
  return res.json({ ok: true });
});

// Helper: recalculate and update employee onboarding_status
async function updateOnboardingStatus(employeeId: string) {
  try {
    const { data: assignments } = await db
      .from("employee_onboarding_assignments")
      .select("status, onboarding_forms(is_required)")
      .eq("employee_id", employeeId);

    if (!assignments || assignments.length === 0) {
      await db.from("employees").update({ onboarding_status: "not_started" }).eq("id", employeeId);
      return;
    }

    const required = (assignments as any[]).filter((a) => (a.onboarding_forms as any)?.is_required);
    const allRequiredComplete = required.every((a) => a.status === "completed");
    const anyComplete = (assignments as any[]).some((a) => a.status === "completed");

    let status = "pending";
    if (allRequiredComplete && required.length > 0) {
      status = "completed";
      await db.from("employees").update({
        onboarding_status: status,
        onboarding_completed_at: new Date().toISOString(),
      }).eq("id", employeeId);
    } else {
      status = anyComplete ? "in_progress" : "pending";
      await db.from("employees").update({ onboarding_status: status }).eq("id", employeeId);
    }
  } catch (err: any) {
    console.error("[employeeOnboarding] updateOnboardingStatus failed:", err.message);
  }
}

export default router;
