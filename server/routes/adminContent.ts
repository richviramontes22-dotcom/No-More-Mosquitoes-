import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
// Service role bypasses RLS — auth is enforced by requireAdmin middleware
const db = supabaseAdmin ?? supabase;

// ─── Blog Posts ───────────────────────────────────────────────────────────────

router.get("/content/blog", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("blog_posts")
    .select("id, slug, title, excerpt, author, tags, published, published_at, reading_time_minutes, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ posts: data || [] });
});

router.post("/content/blog", requireAdmin, async (req, res) => {
  const { slug, title, excerpt, body, author, tags, published, seo_title, seo_description, reading_time_minutes } = req.body;
  if (!slug || !title) return res.status(400).json({ error: "slug and title are required" });

  const { data, error } = await db
    .from("blog_posts")
    .insert({
      slug, title, excerpt, body, author: author || "No More Mosquitoes",
      tags: tags || [], published: published ?? false,
      published_at: published ? new Date().toISOString() : null,
      seo_title, seo_description,
      reading_time_minutes: reading_time_minutes || 3,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ post: data });
});

router.put("/content/blog/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates: any = { ...req.body, updated_at: new Date().toISOString() };
  if (updates.published && !updates.published_at) updates.published_at = new Date().toISOString();

  const { data, error } = await db
    .from("blog_posts").update(updates).eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ post: data });
});

router.delete("/content/blog/:id", requireAdmin, async (req, res) => {
  const { error } = await db.from("blog_posts").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── FAQs ─────────────────────────────────────────────────────────────────────

router.get("/content/faqs", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("faqs")
    .select("id, question, answer, category, display_order, active")
    .order("display_order", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ faqs: data || [] });
});

router.post("/content/faqs", requireAdmin, async (req, res) => {
  const { question, answer, category, display_order } = req.body;
  if (!question || !answer) return res.status(400).json({ error: "question and answer are required" });

  const { data, error } = await db
    .from("faqs")
    .insert({ question, answer, category: category || "general", display_order: display_order ?? 0, active: true })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ faq: data });
});

router.put("/content/faqs/:id", requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from("faqs").update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ faq: data });
});

router.delete("/content/faqs/:id", requireAdmin, async (req, res) => {
  const { error } = await db.from("faqs").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Marketplace Catalog ──────────────────────────────────────────────────────

router.get("/content/catalog", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("catalog_items")
    .select("id, slug, name, category, fulfillment_type, price_type, price_cents, min_price_cents, max_price_cents, currency, image_url, requires_property, requires_schedule, requires_consultation, active, sort_order")
    .order("sort_order", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
});

router.post("/content/catalog", requireAdmin, async (req, res) => {
  const {
    slug, name, category, fulfillment_type, price_type,
    price_cents, min_price_cents, max_price_cents,
    currency, image_url, requires_property, requires_schedule,
    requires_consultation, active, sort_order,
  } = req.body;
  if (!name || !slug) return res.status(400).json({ error: "name and slug are required" });

  const { data, error } = await db
    .from("catalog_items")
    .insert({
      slug, name,
      category: category || "product",
      fulfillment_type: fulfillment_type || "appointment",
      price_type: price_type || "fixed",
      price_cents: price_cents ?? null,
      min_price_cents: min_price_cents ?? null,
      max_price_cents: max_price_cents ?? null,
      currency: currency || "USD",
      image_url: image_url || null,
      requires_property: requires_property ?? true,
      requires_schedule: requires_schedule ?? false,
      requires_consultation: requires_consultation ?? false,
      active: active ?? true,
      sort_order: sort_order ?? 99,
    })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ item: data });
});

router.put("/content/catalog/:id", requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from("catalog_items").update(req.body).eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ item: data });
});

router.delete("/content/catalog/:id", requireAdmin, async (req, res) => {
  const { error } = await db.from("catalog_items").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
