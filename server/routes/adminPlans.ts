import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
// Service role bypasses RLS — auth is enforced by requireAdmin middleware
const db = supabaseAdmin ?? supabase;

const getStripeSecret = () =>
  process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;

async function stripeFetch(path: string, method = "GET", body?: Record<string, string>) {
  const secret = getStripeSecret();
  if (!secret) throw new Error("Stripe not configured");

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) opts.body = new URLSearchParams(body).toString();

  const res = await fetch(`https://api.stripe.com/v1${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── GET /api/admin/plans ─────────────────────────────────────────────────────
router.get("/plans", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("service_plans")
    .select("*")
    .order("acreage_min", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ plans: data || [] });
});

// ─── POST /api/admin/plans ────────────────────────────────────────────────────
router.post("/plans", requireAdmin, async (req, res) => {
  const { name, description, acreage_min, acreage_max, cadence_days, price_cents, program } = req.body;
  if (!name || acreage_min == null || acreage_max == null || !cadence_days || price_cents == null) {
    return res.status(400).json({ error: "name, acreage_min, acreage_max, cadence_days, price_cents are required" });
  }

  let stripe_product_id: string | null = null;
  let stripe_price_id: string | null = null;

  // Create Stripe product + price if Stripe is configured
  try {
    const product = await stripeFetch("/products", "POST", {
      name,
      description: description || name,
    });
    stripe_product_id = product.id;

    const price = await stripeFetch("/prices", "POST", {
      product: product.id,
      unit_amount: String(price_cents),
      currency: "usd",
      "recurring[interval]": "month",
    });
    stripe_price_id = price.id;
  } catch (stripeErr: any) {
    console.warn("[Admin Plans] Stripe sync failed (non-fatal):", stripeErr.message);
  }

  const { data, error } = await db
    .from("service_plans")
    .insert({
      name, description, acreage_min, acreage_max, cadence_days, price_cents,
      program: program || "subscription",
      stripe_product_id, stripe_price_id, active: true,
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ plan: data });
});

// ─── PATCH /api/admin/plans/:id ───────────────────────────────────────────────
router.patch("/plans/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { price_cents, ...rest } = req.body;

  // If price changed and we have Stripe product, create a new Price and archive the old one
  if (price_cents != null) {
    const { data: existing } = await db
      .from("service_plans").select("stripe_product_id, stripe_price_id").eq("id", id).single();

    if (existing?.stripe_product_id) {
      try {
        // Archive old price
        if (existing.stripe_price_id) {
          await stripeFetch(`/prices/${existing.stripe_price_id}`, "POST", { active: "false" });
        }
        // Create new price
        const newPrice = await stripeFetch("/prices", "POST", {
          product: existing.stripe_product_id,
          unit_amount: String(price_cents),
          currency: "usd",
          "recurring[interval]": "month",
        });
        rest.stripe_price_id = newPrice.id;
      } catch (stripeErr: any) {
        console.warn("[Admin Plans] Stripe price update failed (non-fatal):", stripeErr.message);
      }
    }
  }

  const updates = { ...rest, ...(price_cents != null ? { price_cents } : {}), updated_at: new Date().toISOString() };

  const { data, error } = await db
    .from("service_plans").update(updates).eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ plan: data });
});

// ─── DELETE /api/admin/plans/:id ──────────────────────────────────────────────
router.delete("/plans/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  // Soft delete — deactivate rather than hard delete to preserve billing history
  const { data: existing } = await db
    .from("service_plans").select("stripe_price_id").eq("id", id).single();

  if (existing?.stripe_price_id) {
    try {
      await stripeFetch(`/prices/${existing.stripe_price_id}`, "POST", { active: "false" });
    } catch (stripeErr: any) {
      console.warn("[Admin Plans] Stripe archive failed (non-fatal):", stripeErr.message);
    }
  }

  const { error } = await db
    .from("service_plans").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
