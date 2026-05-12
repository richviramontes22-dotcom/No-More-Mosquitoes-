import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const db = supabaseAdmin ?? supabase;

const normalizeZip = (value: unknown) => String(value || "").trim();

const normalizeCapacity = (value: unknown) => {
  if (value === null || value === "" || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/** GET /api/admin/service-areas */
router.get("/service-areas", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("service_areas")
    .select("id, zip, city, state, capacity, is_active, updated_at")
    .order("zip", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ areas: data || [] });
});

/** POST /api/admin/service-areas - add or reactivate/update a ZIP */
router.post("/service-areas", requireAdmin, async (req, res) => {
  const zip = normalizeZip(req.body.zip);
  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: "A valid 5-digit ZIP code is required" });
  }

  const payload = {
    zip,
    city: req.body.city?.trim() || null,
    state: req.body.state?.trim() || null,
    capacity: normalizeCapacity(req.body.capacity),
    is_active: req.body.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const existing = await db
    .from("service_areas")
    .select("id")
    .eq("zip", zip)
    .maybeSingle();

  if (existing.error) return res.status(500).json({ error: existing.error.message });

  const query = existing.data
    ? db.from("service_areas").update(payload).eq("id", existing.data.id)
    : db.from("service_areas").insert(payload);

  const { data, error } = await query.select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(existing.data ? 200 : 201).json({ area: data });
});

/** PATCH /api/admin/service-areas/:id - update ZIP, city, state, capacity, active flag */
router.patch("/service-areas/:id", requireAdmin, async (req, res) => {
  const update: Record<string, any> = {};

  if (req.body.zip !== undefined) {
    const zip = normalizeZip(req.body.zip);
    if (!/^\d{5}$/.test(zip)) {
      return res.status(400).json({ error: "A valid 5-digit ZIP code is required" });
    }
    update.zip = zip;
  }
  if (req.body.city !== undefined) update.city = req.body.city?.trim() || null;
  if (req.body.state !== undefined) update.state = req.body.state?.trim() || null;
  if (req.body.capacity !== undefined) update.capacity = normalizeCapacity(req.body.capacity);
  if (req.body.is_active !== undefined) update.is_active = Boolean(req.body.is_active);
  update.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from("service_areas")
    .update(update)
    .eq("id", req.params.id)
    .select("id, zip, city, state, capacity, is_active, updated_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ area: data });
});

/** DELETE /api/admin/service-areas/:id - soft-deactivate */
router.delete("/service-areas/:id", requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from("service_areas")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select("id, zip, city, state, capacity, is_active, updated_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, area: data });
});

/** GET /api/service-areas/check?zip=XXXXX - public endpoint for address validation */
router.get("/service-areas/check", async (req, res) => {
  const zip = normalizeZip(req.query.zip);
  if (!/^\d{5}$/.test(zip)) return res.json({ covered: false, zip, reason: "invalid_zip" });

  const { data, error } = await db
    .from("service_areas")
    .select("zip, city, state, capacity, is_active")
    .eq("zip", zip)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ covered: false, zip, reason: "lookup_failed", error: error.message });
  }

  res.json({
    covered: !!data,
    zip,
    city: data?.city || null,
    state: data?.state || null,
    capacity: data?.capacity ?? null,
    reason: data ? null : "not_in_service_area",
  });
});

export default router;
