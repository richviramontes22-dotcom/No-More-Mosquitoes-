import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";

// Service role client bypasses RLS — auth is enforced by requireAdmin middleware
const db = supabaseAdmin ?? supabase;

const router = Router();

const getStripeSecret = () =>
  process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;

async function stripeFetch(path: string, method = "GET", body?: Record<string, string>) {
  const secret = getStripeSecret();
  if (!secret) return null; // Non-fatal if Stripe not configured
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
  };
  if (body) opts.body = new URLSearchParams(body).toString();
  const res = await fetch(`https://api.stripe.com/v1${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Promo Codes ──────────────────────────────────────────────────────────────

router.get("/promos/codes", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ codes: data || [] });
});

router.post("/promos/codes", requireAdmin, async (req, res) => {
  const { code, description, discount_type, discount_value, min_order_cents, max_uses, expires_at } = req.body;
  if (!code || !discount_type || discount_value == null) {
    return res.status(400).json({ error: "code, discount_type, and discount_value are required" });
  }

  let stripe_coupon_id: string | null = null;
  let stripe_promotion_code_id: string | null = null;

  // Sync to Stripe
  try {
    const couponBody: Record<string, string> = {
      name: code,
      ...(discount_type === "percent"
        ? { percent_off: String(discount_value) }
        : { amount_off: String(Math.round(Number(discount_value) * 100)), currency: "usd" }),
    };
    if (expires_at) couponBody.redeem_by = String(Math.floor(new Date(expires_at).getTime() / 1000));

    const coupon = await stripeFetch("/coupons", "POST", couponBody);
    if (coupon) {
      stripe_coupon_id = coupon.id;
      const promoBody: Record<string, string> = { coupon: coupon.id, code };
      if (max_uses) promoBody.max_redemptions = String(max_uses);
      const promoCode = await stripeFetch("/promotion_codes", "POST", promoBody);
      if (promoCode) stripe_promotion_code_id = promoCode.id;
    }
  } catch (stripeErr: any) {
    console.warn("[Admin Promos] Stripe sync failed (non-fatal):", stripeErr.message);
  }

  const { data, error } = await db
    .from("promo_codes")
    .insert({
      code: code.trim().toUpperCase(), description, discount_type, discount_value,
      min_order_cents: min_order_cents || 0, max_uses: max_uses || null,
      expires_at: expires_at || null, active: true,
      stripe_coupon_id, stripe_promotion_code_id,
    })
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ code: data });
});

router.patch("/promos/codes/:id", requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from("promo_codes")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ code: data });
});

router.delete("/promos/codes/:id", requireAdmin, async (req, res) => {
  const { data: existing } = await db
    .from("promo_codes").select("stripe_coupon_id").eq("id", req.params.id).single();

  // Archive Stripe coupon
  if (existing?.stripe_coupon_id) {
    try {
      await stripeFetch(`/coupons/${existing.stripe_coupon_id}`, "DELETE");
    } catch (e: any) {
      console.warn("[Admin Promos] Stripe coupon delete failed (non-fatal):", e.message);
    }
  }

  const { error } = await db
    .from("promo_codes")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Campaigns ────────────────────────────────────────────────────────────────

router.get("/promos/campaigns", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("campaigns")
    .select("*, promo_codes(code, discount_type, discount_value)")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ campaigns: data || [] });
});

router.post("/promos/campaigns", requireAdmin, async (req, res) => {
  const { name, description, promo_code_id, start_date, end_date } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const { data, error } = await db
    .from("campaigns")
    .insert({ name, description, promo_code_id: promo_code_id || null, start_date, end_date, active: true })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ campaign: data });
});

router.patch("/promos/campaigns/:id", requireAdmin, async (req, res) => {
  const { data, error } = await db
    .from("campaigns")
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq("id", req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ campaign: data });
});

router.delete("/promos/campaigns/:id", requireAdmin, async (req, res) => {
  const { error } = await db
    .from("campaigns").update({ active: false }).eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ─── Customer promo validation (public endpoint — rate-limited) ──────────────

// In-memory rate limiter: IP → { count, resetAt }
// Note: on serverless (Netlify), each cold-start resets counters — best-effort protection.
// For stricter enforcement, swap for Upstash Redis or similar persistent store.
const promoRateMap = new Map<string, { count: number; resetAt: number }>();
const PROMO_RATE_LIMIT = 10;   // max attempts per window
const PROMO_RATE_WINDOW_MS = 60_000; // 1 minute

function checkPromoRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = promoRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    promoRateMap.set(ip, { count: 1, resetAt: now + PROMO_RATE_WINDOW_MS });
    return true; // allowed
  }
  entry.count += 1;
  if (entry.count > PROMO_RATE_LIMIT) {
    console.warn(`[Promo] Rate limit exceeded for IP: ${ip.slice(0, 12)}***`);
    return false; // blocked
  }
  return true;
}

router.post("/promos/validate", async (req, res) => {
  // IP-based rate limiting (10 req/min)
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (!checkPromoRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
  }

  const { code, order_total_cents } = req.body;
  if (!code || typeof code !== "string") return res.status(400).json({ error: "code is required" });

  // Normalize: trim and uppercase before lookup
  const normalizedCode = code.trim().toUpperCase();

  const { data: promo, error } = await db
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, min_order_cents, max_uses, used_count, expires_at, active, description, promo_code_id, stripe_promotion_code_id")
    .eq("code", normalizedCode)
    .eq("active", true)
    .maybeSingle();

  if (error) return res.status(500).json({ error: "Unable to validate code. Please try again." });

  // Generic "invalid" — do NOT reveal whether code exists vs is expired vs exhausted
  // This prevents enumeration. Specific UX messages follow only after code is confirmed valid.
  if (!promo) return res.status(400).json({ error: "This promo code is not valid." });

  // Expiry check (specific message OK here — code is confirmed to exist)
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return res.status(400).json({ error: "This promo code has expired." });
  }

  // Usage limit check (specific message OK here)
  if (promo.max_uses != null && promo.used_count >= promo.max_uses) {
    return res.status(400).json({ error: "This promo code has reached its usage limit." });
  }

  // Minimum order check
  if (order_total_cents != null && promo.min_order_cents > 0 && order_total_cents < promo.min_order_cents) {
    return res.status(400).json({
      error: `Minimum order of $${(promo.min_order_cents / 100).toFixed(2)} required for this code.`,
    });
  }

  // Calculate discount
  let discount_cents = 0;
  if (promo.discount_type === "percent") {
    discount_cents = order_total_cents != null
      ? Math.floor(order_total_cents * (promo.discount_value / 100))
      : 0;
  } else {
    discount_cents = Math.round(promo.discount_value * 100);
  }

  // Return only what the checkout flow needs — no internal DB fields beyond what's required
  res.json({
    valid: true,
    promo_code_id: promo.id,                               // needed to increment used_count after payment
    stripe_promotion_code_id: promo.stripe_promotion_code_id, // needed for Stripe-level discount
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    discount_cents,
    description: promo.description,
  });
});

export default router;
