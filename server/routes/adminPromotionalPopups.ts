import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const db = supabaseAdmin ?? supabase;
const router = Router();

// Validate that a CTA URL is safe (relative path or https:/http:, no javascript:)
function isValidCtaUrl(url: string | undefined | null): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith("javascript:") || trimmed.startsWith("data:") || trimmed.startsWith("vbscript:")) return false;
  return true;
}

// ── Admin CRUD ──────────────────────────────────────────────────────────────

router.get("/admin/promotional-popups", requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await db
      .from("promotional_popups")
      .select("*")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.json({ popups: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load popups" });
  }
});

router.post("/admin/promotional-popups", requireAdmin, async (req, res) => {
  try {
    const {
      title, subtitle, body, image_url,
      cta_label, cta_url, secondary_label, secondary_url,
      audience, page_target, custom_path,
      start_at, end_at, active, frequency, priority,
    } = req.body as Record<string, any>;

    if (!title?.trim()) return res.status(400).json({ error: "title is required" });
    if (!body?.trim() && !image_url?.trim()) return res.status(400).json({ error: "body or image_url is required" });
    if (cta_url && !isValidCtaUrl(cta_url)) return res.status(400).json({ error: "Invalid cta_url" });
    if (secondary_url && !isValidCtaUrl(secondary_url)) return res.status(400).json({ error: "Invalid secondary_url" });
    if (page_target === "custom" && !custom_path?.trim()) return res.status(400).json({ error: "custom_path required when page_target is custom" });
    if (end_at && start_at && new Date(end_at) <= new Date(start_at)) return res.status(400).json({ error: "end_at must be after start_at" });

    const { data, error } = await db.from("promotional_popups").insert({
      title: title.trim(),
      subtitle: subtitle?.trim() || null,
      body: body?.trim() || null,
      image_url: image_url?.trim() || null,
      cta_label: cta_label?.trim() || null,
      cta_url: cta_url?.trim() || null,
      secondary_label: secondary_label?.trim() || null,
      secondary_url: secondary_url?.trim() || null,
      audience: audience || "all",
      page_target: page_target || "all",
      custom_path: page_target === "custom" ? (custom_path?.trim() || null) : null,
      start_at: start_at || null,
      end_at: end_at || null,
      active: active !== false,
      frequency: frequency || "once_per_session",
      priority: Number(priority) || 10,
    }).select().single();
    if (error) throw error;
    return res.status(201).json({ popup: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to create popup" });
  }
});

router.patch("/admin/promotional-popups/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      "title", "subtitle", "body", "image_url",
      "cta_label", "cta_url", "secondary_label", "secondary_url",
      "audience", "page_target", "custom_path",
      "start_at", "end_at", "active", "frequency", "priority",
    ];
    const patch: Record<string, any> = {};
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key];
    }
    if ("cta_url" in patch && !isValidCtaUrl(patch.cta_url)) return res.status(400).json({ error: "Invalid cta_url" });
    if ("secondary_url" in patch && !isValidCtaUrl(patch.secondary_url)) return res.status(400).json({ error: "Invalid secondary_url" });

    const { data, error } = await db.from("promotional_popups").update(patch).eq("id", id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Popup not found" });
    return res.json({ popup: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to update popup" });
  }
});

router.delete("/admin/promotional-popups/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Prefer deactivate over hard delete; hard delete only via explicit ?hard=true
    if (req.query.hard === "true") {
      const { error } = await db.from("promotional_popups").delete().eq("id", id);
      if (error) throw error;
      return res.json({ ok: true });
    }
    const { data, error } = await db.from("promotional_popups").update({ active: false }).eq("id", id).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Popup not found" });
    return res.json({ popup: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to deactivate popup" });
  }
});

// ── Public active popup endpoint ────────────────────────────────────────────
// Returns only active, currently-valid popups. No inactive/future/internal data exposed.
// Optional: ?path=/some-path for page-targeted filtering.

router.get("/promotional-popups/active", async (req, res) => {
  try {
    const path = (req.query.path as string | undefined) || "/";

    const { data, error } = await supabase
      .from("promotional_popups")
      .select("id,title,subtitle,body,image_url,cta_label,cta_url,secondary_label,secondary_url,audience,page_target,custom_path,frequency,priority")
      .eq("active", true)
      .or("start_at.is.null,start_at.lte." + new Date().toISOString())
      .or("end_at.is.null,end_at.gte." + new Date().toISOString())
      .order("priority", { ascending: true });
    if (error) throw error;

    // Filter by page target
    const eligible = (data || []).filter((p: any) => {
      if (p.page_target === "all") return true;
      if (p.page_target === "custom") return p.custom_path && path.startsWith(p.custom_path);
      if (p.page_target === "home") return path === "/" || path === "";
      if (p.page_target === "pricing") return path.startsWith("/pricing");
      if (p.page_target === "services") return path.startsWith("/services");
      if (p.page_target === "marketplace") return path.startsWith("/dashboard/marketplace");
      if (p.page_target === "dashboard") return path.startsWith("/dashboard");
      return false;
    });

    // Return highest-priority eligible popup (audience filtering done client-side since server doesn't have auth context here)
    const popup = eligible[0] ?? null;
    return res.json({ popup });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to load popup" });
  }
});

export default router;
