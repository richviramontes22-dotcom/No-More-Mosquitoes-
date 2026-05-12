import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

// ─── Content Slots ────────────────────────────────────────────────────────────

/** GET /api/admin/cms/content — list all content slots */
router.get("/cms/content", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("site_content")
    .select("key, value, draft_value, content_type, status, updated_at, published_at")
    .order("key");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ slots: data || [] });
});

/** GET /api/admin/cms/content/:key — single slot (admin, includes draft) */
router.get("/cms/content/:key", requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from("site_content")
    .select("*")
    .eq("key", req.params.key)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Content slot not found" });
  res.json({ slot: data });
});

/** PATCH /api/admin/cms/content/:key — save as draft */
router.patch("/cms/content/:key", requireAdmin, async (req, res) => {
  const { value } = req.body;
  if (typeof value !== "string") return res.status(400).json({ error: "value must be a string" });
  if (value.length > 2000) return res.status(400).json({ error: "value exceeds 2000 character limit" });

  // Reject anything that looks like HTML tags
  if (/<[^>]+>/.test(value)) return res.status(400).json({ error: "HTML is not allowed in content slots" });

  // Keep status='published' so public RLS always allows reads.
  // Draft state is indicated solely by draft_value IS NOT NULL.
  const { data, error } = await db
    .from("site_content")
    .upsert({
      key: req.params.key,
      draft_value: value,
      status: "published",
      updated_at: new Date().toISOString(),
      updated_by: req.adminUserId ?? null,
    }, { onConflict: "key" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ slot: data });
});

/** POST /api/admin/cms/content/:key/publish — move draft → published */
router.post("/cms/content/:key/publish", requireAdmin, async (req, res) => {
  const { data: existing } = await db
    .from("site_content")
    .select("draft_value, value")
    .eq("key", req.params.key)
    .maybeSingle();

  if (!existing?.draft_value) {
    return res.status(400).json({ error: "No draft to publish" });
  }

  const { data, error } = await db
    .from("site_content")
    .update({
      value: existing.draft_value,
      draft_value: null,
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: req.adminUserId ?? null,
    })
    .eq("key", req.params.key)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ slot: data });
});

/** POST /api/admin/cms/content/:key/discard — discard draft */
router.post("/cms/content/:key/discard", requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from("site_content")
    .update({
      draft_value: null,
      status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("key", req.params.key)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ slot: data });
});

/** POST /api/admin/cms/content/publish-all — publish all pending drafts */
router.post("/cms/content/publish-all", requireAdmin, async (_req, res) => {
  const { data: drafts } = await db
    .from("site_content")
    .select("key, draft_value")
    .not("draft_value", "is", null);

  if (!drafts?.length) return res.json({ published: 0 });

  const now = new Date().toISOString();
  for (const row of drafts) {
    await db.from("site_content").update({
      value: row.draft_value,
      draft_value: null,
      status: "published",
      published_at: now,
      updated_at: now,
    }).eq("key", row.key);
  }

  res.json({ published: drafts.length });
});

// ─── Image Slots ──────────────────────────────────────────────────────────────

/** GET /api/admin/cms/images — list all image slots */
router.get("/cms/images", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("site_images")
    .select("id, key, label, image_url, draft_image_url, focal_x, focal_y, draft_focal_x, draft_focal_y, alt_text, draft_alt_text, status, updated_at, published_at")
    .order("key");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ images: data || [] });
});

/** PATCH /api/admin/cms/images/:key — save image draft (URL, focal, alt) */
router.patch("/cms/images/:key", requireAdmin, async (req, res) => {
  const { draft_image_url, draft_focal_x, draft_focal_y, draft_alt_text } = req.body;

  // Keep status='published' so public RLS always allows reads.
  // Draft state is indicated solely by draft_* fields being non-null.
  const updates: Record<string, any> = {
    status: "published",
    updated_at: new Date().toISOString(),
    updated_by: req.adminUserId ?? null,
  };

  if (typeof draft_image_url === "string") updates.draft_image_url = draft_image_url;
  if (typeof draft_focal_x === "number") updates.draft_focal_x = Math.min(100, Math.max(0, draft_focal_x));
  if (typeof draft_focal_y === "number") updates.draft_focal_y = Math.min(100, Math.max(0, draft_focal_y));
  if (typeof draft_alt_text === "string" && draft_alt_text.length <= 200) updates.draft_alt_text = draft_alt_text;

  const { data, error } = await db
    .from("site_images")
    .update(updates)
    .eq("key", req.params.key)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ image: data });
});

/** POST /api/admin/cms/images/:key/publish */
router.post("/cms/images/:key/publish", requireAdmin, async (req, res) => {
  const { data: existing } = await db
    .from("site_images")
    .select("draft_image_url, draft_focal_x, draft_focal_y, draft_alt_text, image_url, focal_x, focal_y, alt_text")
    .eq("key", req.params.key)
    .maybeSingle();

  if (!existing) return res.status(404).json({ error: "Image slot not found" });

  const { data, error } = await db
    .from("site_images")
    .update({
      image_url: existing.draft_image_url ?? existing.image_url,
      focal_x: existing.draft_focal_x ?? existing.focal_x,
      focal_y: existing.draft_focal_y ?? existing.focal_y,
      alt_text: existing.draft_alt_text ?? existing.alt_text,
      draft_image_url: null,
      draft_focal_x: null,
      draft_focal_y: null,
      draft_alt_text: null,
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("key", req.params.key)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ image: data });
});

/** POST /api/admin/cms/images/:key/discard */
router.post("/cms/images/:key/discard", requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from("site_images")
    .update({
      draft_image_url: null,
      draft_focal_x: null,
      draft_focal_y: null,
      draft_alt_text: null,
      status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("key", req.params.key)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ image: data });
});

// ─── Marketplace Catalog ──────────────────────────────────────────────────────

/** GET /api/admin/cms/catalog — all items including inactive */
router.get("/cms/catalog", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("catalog_items")
    .select("id, slug, name, category, fulfillment_type, price_type, price_cents, min_price_cents, max_price_cents, image_url, active, is_featured, display_order, description")
    .order("display_order", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
});

/** POST /api/admin/cms/catalog */
router.post("/cms/catalog", requireAdmin, async (req, res) => {
  const {
    slug, name, category, fulfillment_type, price_type,
    price_cents, min_price_cents, max_price_cents,
    image_url, description, active, is_featured, display_order,
  } = req.body;

  if (!name?.trim() || !slug?.trim()) return res.status(400).json({ error: "name and slug are required" });

  const { data, error } = await db
    .from("catalog_items")
    .insert({
      slug: slug.trim(), name: name.trim(),
      category: category || "product",
      fulfillment_type: fulfillment_type || "appointment",
      price_type: price_type || "fixed",
      price_cents: price_cents ?? null,
      min_price_cents: min_price_cents ?? null,
      max_price_cents: max_price_cents ?? null,
      image_url: image_url || null,
      description: description?.trim() || null,
      active: active ?? true,
      is_featured: is_featured ?? false,
      display_order: display_order ?? 99,
      requires_property: true,
      requires_schedule: false,
      requires_consultation: false,
      currency: "USD",
      sort_order: display_order ?? 99,
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ item: data });
});

/** PATCH /api/admin/cms/catalog/:id */
router.patch("/cms/catalog/:id", requireAdmin, async (req, res) => {
  const allowed = ["name", "description", "price_cents", "min_price_cents", "max_price_cents",
    "price_type", "category", "fulfillment_type", "image_url", "active", "is_featured", "display_order"];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.display_order !== undefined) updates.sort_order = updates.display_order;

  const { data, error } = await db
    .from("catalog_items")
    .update(updates)
    .eq("id", req.params.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ item: data });
});

/** DELETE /api/admin/cms/catalog/:id — soft delete (active=false) */
router.delete("/cms/catalog/:id", requireAdmin, async (req, res) => {
  const { error } = await db
    .from("catalog_items")
    .update({ active: false })
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Preview data (admin only) ────────────────────────────────────────────────

/** GET /api/admin/cms/preview — all content + images with draft values for preview */
router.get("/cms/preview", requireAdmin, async (_req, res) => {
  const [contentRes, imagesRes] = await Promise.all([
    db.from("site_content").select("key, value, draft_value, status"),
    db.from("site_images").select("key, image_url, draft_image_url, focal_x, focal_y, draft_focal_x, draft_focal_y, alt_text, draft_alt_text, status"),
  ]);

  if (contentRes.error) return res.status(500).json({ error: contentRes.error.message });
  if (imagesRes.error) return res.status(500).json({ error: imagesRes.error.message });

  // For preview: prefer draft_value if present
  const content: Record<string, string> = {};
  for (const row of contentRes.data || []) {
    content[row.key] = row.draft_value ?? row.value ?? "";
  }

  const images: Record<string, { url: string | null; focal_x: number; focal_y: number; alt: string }> = {};
  for (const row of imagesRes.data || []) {
    images[row.key] = {
      url: row.draft_image_url ?? row.image_url ?? null,
      focal_x: row.draft_focal_x ?? row.focal_x ?? 50,
      focal_y: row.draft_focal_y ?? row.focal_y ?? 50,
      alt: row.draft_alt_text ?? row.alt_text ?? "",
    };
  }

  res.json({ content, images });
});

// ─── Publish all ──────────────────────────────────────────────────────────────

/** POST /api/admin/cms/publish-all — publish all pending drafts (content + images) */
router.post("/cms/publish-all", requireAdmin, async (_req, res) => {
  const now = new Date().toISOString();
  let contentPublished = 0;
  let imagesPublished = 0;

  const { data: contentDrafts } = await db
    .from("site_content").select("key, draft_value").not("draft_value", "is", null);

  for (const row of contentDrafts || []) {
    await db.from("site_content").update({
      value: row.draft_value, draft_value: null,
      status: "published", published_at: now, updated_at: now,
    }).eq("key", row.key);
    contentPublished++;
  }

  const { data: imageDrafts } = await db
    .from("site_images").select("key, draft_image_url, draft_focal_x, draft_focal_y, draft_alt_text, image_url, focal_x, focal_y, alt_text")
    .or("draft_image_url.not.is.null,draft_focal_x.not.is.null,draft_alt_text.not.is.null");

  for (const row of imageDrafts || []) {
    await db.from("site_images").update({
      image_url: row.draft_image_url ?? row.image_url,
      focal_x: row.draft_focal_x ?? row.focal_x,
      focal_y: row.draft_focal_y ?? row.focal_y,
      alt_text: row.draft_alt_text ?? row.alt_text,
      draft_image_url: null, draft_focal_x: null, draft_focal_y: null, draft_alt_text: null,
      status: "published", published_at: now, updated_at: now,
    }).eq("key", row.key);
    imagesPublished++;
  }

  res.json({ contentPublished, imagesPublished });
});

// ─── Carousel Image Slots ─────────────────────────────────────────────────────

/** GET /api/admin/cms/carousel/:slot — list all active items in display order */
router.get("/cms/carousel/:slot", requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from("site_carousel_items")
    .select("id, image_url, alt_text, focal_x, focal_y, display_order, active")
    .eq("slot_key", req.params.slot)
    .order("display_order", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
});

/** POST /api/admin/cms/carousel/:slot — add a new image */
router.post("/cms/carousel/:slot", requireAdmin, async (req, res) => {
  const { image_url, alt_text, focal_x, focal_y } = req.body;
  if (!image_url) return res.status(400).json({ error: "image_url is required" });

  // Place new item at end of list
  const { data: last } = await db
    .from("site_carousel_items")
    .select("display_order")
    .eq("slot_key", req.params.slot)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.display_order ?? 0) + 1;

  const { data, error } = await db
    .from("site_carousel_items")
    .insert({
      slot_key: req.params.slot,
      image_url,
      alt_text: alt_text?.trim() || "",
      focal_x: focal_x ?? 50,
      focal_y: focal_y ?? 50,
      display_order: nextOrder,
      active: true,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ item: data });
});

/** PATCH /api/admin/cms/carousel/item/:id — update alt, focal point, or order */
router.patch("/cms/carousel/item/:id", requireAdmin, async (req, res) => {
  const allowed: Record<string, any> = {};
  const { alt_text, focal_x, focal_y, display_order, active } = req.body;
  if (alt_text !== undefined) allowed.alt_text = alt_text;
  if (focal_x !== undefined) allowed.focal_x = Math.min(100, Math.max(0, focal_x));
  if (focal_y !== undefined) allowed.focal_y = Math.min(100, Math.max(0, focal_y));
  if (display_order !== undefined) allowed.display_order = display_order;
  if (active !== undefined) allowed.active = active;

  const { data, error } = await db
    .from("site_carousel_items")
    .update(allowed)
    .eq("id", req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ item: data });
});

/** DELETE /api/admin/cms/carousel/item/:id — remove image from carousel */
router.delete("/cms/carousel/item/:id", requireAdmin, async (req, res) => {
  const { error } = await db.from("site_carousel_items").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/** POST /api/admin/cms/carousel/:slot/reorder — set display_order for all items at once */
router.post("/cms/carousel/:slot/reorder", requireAdmin, async (req, res) => {
  // Body: { order: [{ id, display_order }] }
  const { order } = req.body as { order: Array<{ id: string; display_order: number }> };
  if (!Array.isArray(order)) return res.status(400).json({ error: "order array required" });

  for (const item of order) {
    await db.from("site_carousel_items")
      .update({ display_order: item.display_order })
      .eq("id", item.id)
      .eq("slot_key", req.params.slot);
  }

  res.json({ success: true });
});

// ─── JSON List Content (testimonials, services, benefits) ─────────────────────

const ALLOWED_LIST_KEYS = ["testimonials_list", "services_list", "benefits_list"];

/** GET /api/admin/cms/lists — fetch all JSON list slots */
router.get("/cms/lists", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("site_content")
    .select("key, value, updated_at")
    .in("key", ALLOWED_LIST_KEYS);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ lists: data || [] });
});

/** PUT /api/admin/cms/lists/:key — save JSON list (immediate publish, no draft) */
router.put("/cms/lists/:key", requireAdmin, async (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_LIST_KEYS.includes(key)) {
    return res.status(400).json({ error: "Unknown list key" });
  }
  const { value } = req.body;
  if (typeof value !== "string") return res.status(400).json({ error: "value must be a JSON string" });
  try { JSON.parse(value); } catch { return res.status(400).json({ error: "value must be valid JSON" }); }
  if (value.length > 50000) return res.status(400).json({ error: "List too large (max 50 KB)" });

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("site_content")
    .upsert({
      key,
      value,
      draft_value: null,
      content_type: "json_list",
      status: "published",
      updated_at: now,
      published_at: now,
      updated_by: req.adminUserId ?? null,
    }, { onConflict: "key" })
    .select("key, value, updated_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ list: data });
});

// ─── FAQ CRUD ─────────────────────────────────────────────────────────────────

/** GET /api/admin/cms/faqs — list all FAQs including inactive */
router.get("/cms/faqs", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("faqs")
    .select("id, question, answer, category, display_order, active")
    .order("display_order", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ faqs: data || [] });
});

/** POST /api/admin/cms/faqs — create FAQ */
router.post("/cms/faqs", requireAdmin, async (req, res) => {
  const { question, answer, category } = req.body;
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ error: "question and answer are required" });
  }
  const { data: maxRow } = await db
    .from("faqs")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.display_order ?? 0) + 1;

  const { data, error } = await db
    .from("faqs")
    .insert({
      question: question.trim(),
      answer: answer.trim(),
      category: category?.trim() || null,
      display_order: nextOrder,
      active: true,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ faq: data });
});

/** PATCH /api/admin/cms/faqs/:id — update FAQ fields */
router.patch("/cms/faqs/:id", requireAdmin, async (req, res) => {
  const { question, answer, category, active, display_order } = req.body;
  const updates: Record<string, any> = {};
  if (question !== undefined) updates.question = String(question).trim();
  if (answer !== undefined) updates.answer = String(answer).trim();
  if (category !== undefined) updates.category = category || null;
  if (active !== undefined) updates.active = Boolean(active);
  if (display_order !== undefined) updates.display_order = Number(display_order);

  const { data, error } = await db
    .from("faqs")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ faq: data });
});

/** DELETE /api/admin/cms/faqs/:id — soft-deactivate FAQ */
router.delete("/cms/faqs/:id", requireAdmin, async (req, res) => {
  const { error } = await db
    .from("faqs")
    .update({ active: false })
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
