import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

const DOCUMENT_TYPES = ["terms_and_conditions", "privacy_policy", "service_agreement", "pesticide_consent"] as const;
const STATUSES = ["draft", "attorney_review", "approved", "deployed", "archived"] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

const REQUIRE_FLAG_BY_TYPE: Record<DocumentType, string> = {
  terms_and_conditions: "require_terms",
  privacy_policy: "require_privacy",
  service_agreement: "require_service_agreement",
  pesticide_consent: "require_pesticide_consent",
};

async function getAuthenticatedUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw Object.assign(new Error("Missing auth header"), { status: 401 });
  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error("Invalid session"), { status: 401 });
  return user;
}

// ─── Admin: documents ───────────────────────────────────────────────────────────

router.get("/admin/legal/documents", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("legal_documents")
    .select("*")
    .order("document_type", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ documents: data ?? [] });
});

router.get("/admin/legal/documents/:id", requireAdmin, async (req, res) => {
  const { data, error } = await db.from("legal_documents").select("*").eq("id", req.params.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Document not found" });
  res.json({ document: data });
});

/**
 * POST /api/admin/legal/documents
 * Creates a NEW draft version for a document_type. Never overwrites an
 * existing row — a fresh row is always inserted, so version history is
 * fully preserved (old versions just sit at whatever status they were left in,
 * most commonly 'archived' once a newer version is deployed).
 */
router.post("/admin/legal/documents", requireAdmin, async (req, res) => {
  const { document_type, title, version, content_md, file_url, file_name, mime_type, effective_date } = req.body ?? {};

  if (!document_type || !DOCUMENT_TYPES.includes(document_type)) {
    return res.status(400).json({ error: `document_type must be one of: ${DOCUMENT_TYPES.join(", ")}` });
  }
  if (!title || !version) {
    return res.status(400).json({ error: "title and version are required" });
  }

  const adminId = (req as any).adminUserId ?? null;

  const { data, error } = await db
    .from("legal_documents")
    .insert({
      document_type, title, version, status: "draft",
      content_md: content_md ?? null,
      file_url: file_url ?? null,
      file_name: file_name ?? null,
      mime_type: mime_type ?? null,
      uploaded_by: adminId,
      effective_date: effective_date || null,
    })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ document: data });
});

/**
 * PATCH /api/admin/legal/documents/:id
 * Edits a document still in draft (title/version/content/file metadata/effective_date),
 * or transitions its status. Deploying is handled by the dedicated /deploy endpoint
 * below (it has extra side effects — archiving the prior deployed version).
 */
router.patch("/admin/legal/documents/:id", requireAdmin, async (req, res) => {
  const { title, version, content_md, file_url, file_name, mime_type, effective_date, status } = req.body ?? {};

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
    }
    if (status === "deployed") {
      return res.status(400).json({ error: "Use POST /admin/legal/documents/:id/deploy to deploy a document." });
    }
  }

  const updates: Record<string, any> = {};
  if (title !== undefined) updates.title = title;
  if (version !== undefined) updates.version = version;
  if (content_md !== undefined) updates.content_md = content_md;
  if (file_url !== undefined) updates.file_url = file_url;
  if (file_name !== undefined) updates.file_name = file_name;
  if (mime_type !== undefined) updates.mime_type = mime_type;
  if (effective_date !== undefined) updates.effective_date = effective_date;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });

  const { data, error } = await db.from("legal_documents").update(updates).eq("id", req.params.id).select("*").single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ document: data });
});

/**
 * POST /api/admin/legal/documents/:id/deploy
 * Deploys an approved document: sets status='deployed', deployed_at=now(),
 * and archives whatever was previously deployed for the same document_type
 * (there is exactly one deployed version per type at a time). Refuses to
 * deploy anything not already 'approved' — attorney review must have happened.
 */
router.post("/admin/legal/documents/:id/deploy", requireAdmin, async (req, res) => {
  const { data: doc } = await db.from("legal_documents").select("*").eq("id", req.params.id).maybeSingle();
  if (!doc) return res.status(404).json({ error: "Document not found" });
  if ((doc as any).status !== "approved") {
    return res.status(400).json({ error: `Document must be 'approved' before it can be deployed (currently '${(doc as any).status}').` });
  }

  const now = new Date().toISOString();

  // Archive the currently-deployed version of this type, if any.
  await db
    .from("legal_documents")
    .update({ status: "archived" })
    .eq("document_type", (doc as any).document_type)
    .eq("status", "deployed");

  const { data: deployed, error } = await db
    .from("legal_documents")
    .update({ status: "deployed", deployed_at: now })
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ document: deployed });
});

// ─── Admin: settings ─────────────────────────────────────────────────────────

async function getOrCreateSettings() {
  const { data } = await db.from("legal_acceptance_settings").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (data) return data;
  const { data: created } = await db.from("legal_acceptance_settings").insert({ enforcement_enabled: false }).select("*").single();
  return created;
}

router.get("/admin/legal/settings", requireAdmin, async (_req, res) => {
  const settings = await getOrCreateSettings();
  res.json({ settings });
});

/**
 * PATCH /api/admin/legal/settings
 * Toggling enforcement_enabled to true is only allowed when every currently-
 * required document type has a deployed version. Returns 400 with the
 * specific missing types otherwise — never silently ignores the request.
 */
router.patch("/admin/legal/settings", requireAdmin, async (req, res) => {
  const { enforcement_enabled, require_terms, require_privacy, require_service_agreement, require_pesticide_consent } = req.body ?? {};
  const current = await getOrCreateSettings();

  const nextRequireFlags = {
    require_terms: require_terms !== undefined ? require_terms : (current as any).require_terms,
    require_privacy: require_privacy !== undefined ? require_privacy : (current as any).require_privacy,
    require_service_agreement: require_service_agreement !== undefined ? require_service_agreement : (current as any).require_service_agreement,
    require_pesticide_consent: require_pesticide_consent !== undefined ? require_pesticide_consent : (current as any).require_pesticide_consent,
  };

  if (enforcement_enabled === true) {
    const { data: deployed } = await db.from("legal_documents").select("document_type").eq("status", "deployed");
    const deployedTypes = new Set((deployed ?? []).map((d: any) => d.document_type));

    const missing = (Object.keys(REQUIRE_FLAG_BY_TYPE) as DocumentType[]).filter((type) => {
      const requireFlag = (nextRequireFlags as any)[REQUIRE_FLAG_BY_TYPE[type]];
      return requireFlag && !deployedTypes.has(type);
    });

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Cannot enable enforcement — the following required document types have no deployed version: ${missing.join(", ")}. Deploy an approved version of each before enabling enforcement.`,
        missing_document_types: missing,
      });
    }
  }

  const updates: Record<string, any> = { ...nextRequireFlags, updated_by: (req as any).adminUserId ?? null };
  if (enforcement_enabled !== undefined) updates.enforcement_enabled = enforcement_enabled;

  const { data, error } = await db
    .from("legal_acceptance_settings")
    .update(updates)
    .eq("id", (current as any).id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ settings: data });
});

// ─── Public ──────────────────────────────────────────────────────────────────

/**
 * GET /api/legal/status
 * Used by the signup gate and the dashboard re-acceptance check. Returns
 * enforcement state plus the currently-required, currently-deployed document
 * set (id + version) — never includes draft/attorney_review/approved rows.
 */
router.get("/legal/status", async (_req, res) => {
  const settings = await getOrCreateSettings();

  if (!(settings as any).enforcement_enabled) {
    return res.json({ enforcement_enabled: false, required: [] });
  }

  const { data: deployed } = await db
    .from("legal_documents")
    .select("id, document_type, title, version")
    .eq("status", "deployed");

  const required = (deployed ?? []).filter((d: any) => (settings as any)[REQUIRE_FLAG_BY_TYPE[d.document_type as DocumentType]]);

  res.json({
    enforcement_enabled: true,
    required: required.map((d: any) => ({ document_id: d.id, document_type: d.document_type, title: d.title, version: d.version })),
  });
});

/**
 * GET /api/legal/my-acceptances
 * Authenticated — returns the caller's own acceptance records (most recent
 * per document_type). Used by the dashboard-entry gate to determine whether
 * the customer has already accepted the currently-required deployed versions.
 */
router.get("/legal/my-acceptances", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { data, error } = await db
      .from("customer_legal_acceptances")
      .select("document_id, document_type, document_version, accepted_at")
      .eq("profile_id", user.id)
      .order("accepted_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Collapse to most-recent-per-type (rows are already ordered desc).
    const latestByType: Record<string, any> = {};
    for (const row of data ?? []) {
      if (!latestByType[row.document_type]) latestByType[row.document_type] = row;
    }

    res.json({ acceptances: Object.values(latestByType) });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * GET /api/legal/documents/:type
 * Public document fetch — only ever returns a 'deployed' row. Used by the
 * /legal/* public pages. 404 (with a friendly message) if nothing is deployed yet.
 */
router.get("/legal/documents/:type", async (req, res) => {
  const type = req.params.type;
  if (!DOCUMENT_TYPES.includes(type as DocumentType)) {
    return res.status(400).json({ error: "Unknown document type" });
  }

  const { data, error } = await db
    .from("legal_documents")
    .select("id, document_type, title, version, content_md, file_url, file_name, mime_type, effective_date, deployed_at")
    .eq("document_type", type)
    .eq("status", "deployed")
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Document not yet published" });
  res.json({ document: data });
});

/**
 * POST /api/legal/acceptances
 * Customer-facing — writes one row per accepted document for the
 * authenticated caller. Body: { acceptances: [{ document_id, document_type, document_version }] }
 * Always uses the caller's own verified user id, never a client-supplied profile_id.
 */
router.post("/legal/acceptances", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { acceptances } = req.body ?? {};

    if (!Array.isArray(acceptances) || acceptances.length === 0) {
      return res.status(400).json({ error: "acceptances array is required" });
    }

    const settings = await getOrCreateSettings();
    if (!(settings as any).enforcement_enabled) {
      return res.status(400).json({ error: "Legal acceptance enforcement is not currently enabled." });
    }

    const rows = acceptances.map((a: any) => ({
      profile_id: user.id,
      document_id: a.document_id,
      document_type: a.document_type,
      document_version: a.document_version,
      ip_address: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null,
      user_agent: req.headers["user-agent"] || null,
      acceptance_method: a.acceptance_method || "registration_checkbox",
    }));

    const { data, error } = await db.from("customer_legal_acceptances").insert(rows).select("*");
    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({ acceptances: data });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
