import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAdmin } from "../middleware/requireAdmin";
import { createMarketplaceAddOnServiceOrder } from "../services/serviceOrders";

const router = Router();
const db = supabaseAdmin ?? supabase;

// ── GET single marketplace order with line items ───────────────────────────

router.get("/marketplace/orders/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: order, error } = await db
    .from("marketplace_orders")
    .select(`
      id, user_id, appointment_id, property_id,
      stripe_payment_intent_id, stripe_session_id,
      subtotal_cents, tax_cents, total_cents, currency,
      status, fulfillment_status, confirmation_id,
      created_at,
      profiles:user_id (id, name, email, phone),
      properties:property_id (id, address, city, zip)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const { data: items, error: itemsError } = await db
    .from("marketplace_order_items")
    .select("id, catalog_item_id, item_name, quantity, unit_price_cents, line_total_cents, price_type, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  if (itemsError) return res.status(500).json({ error: itemsError.message });

  res.json({ order, items: items || [] });
});

// ── PATCH fulfillment status ───────────────────────────────────────────────

const ALLOWED_FULFILLMENT_STATUSES = ["pending", "processing", "scheduled", "fulfilled", "cancelled"] as const;
type FulfillmentStatus = typeof ALLOWED_FULFILLMENT_STATUSES[number];

router.patch("/marketplace/orders/:id/fulfillment", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { fulfillment_status } = req.body as { fulfillment_status: FulfillmentStatus };

  if (!ALLOWED_FULFILLMENT_STATUSES.includes(fulfillment_status)) {
    return res.status(400).json({
      error: `fulfillment_status must be one of: ${ALLOWED_FULFILLMENT_STATUSES.join(", ")}`,
    });
  }

  // Fetch current order to validate state transition
  const { data: current } = await db
    .from("marketplace_orders")
    .select("status, fulfillment_status")
    .eq("id", id)
    .maybeSingle();

  if (!current) return res.status(404).json({ error: "Order not found" });

  // Block fulfillment updates on failed/expired orders unless cancelling
  if (
    (current.status === "failed" || current.status === "expired") &&
    fulfillment_status !== "cancelled"
  ) {
    return res.status(422).json({
      error: "Cannot update fulfillment on a failed or expired order unless cancelling.",
    });
  }

  const { data, error } = await db
    .from("marketplace_orders")
    .update({ fulfillment_status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status, fulfillment_status, updated_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ order: data });
});

// ── GET subscriptions needing appointment scheduling ──────────────────────

router.get("/subscriptions/needs-scheduling", requireAdmin, async (_req, res) => {
  // Fetch active subscriptions with customer and property info
  const { data: subs, error } = await db
    .from("subscriptions")
    .select(`
      id, user_id, property_id, status, cadence_days,
      current_period_end, last_payment_at, created_at,
      profiles:user_id (id, name, email),
      properties:property_id (id, address, city, zip, acreage)
    `)
    .eq("status", "active")
    .order("last_payment_at", { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  if (!subs?.length) return res.json({ queue: [] });

  // For each subscription, check if a future non-cancelled appointment exists
  const now = new Date().toISOString();
  const queue = [];

  for (const sub of subs) {
    if (!sub.user_id || !sub.property_id) continue;

    const { count } = await db
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", sub.user_id)
      .eq("property_id", sub.property_id)
      .gte("scheduled_at", now)
      .not("status", "in", '("cancelled","canceled")');

    if ((count ?? 0) === 0) {
      queue.push({
        subscription_id: sub.id,
        user_id: sub.user_id,
        property_id: sub.property_id,
        status: sub.status,
        cadence_days: sub.cadence_days,
        current_period_end: sub.current_period_end,
        last_payment_at: sub.last_payment_at,
        customer: (sub as any).profiles ?? null,
        property: (sub as any).properties ?? null,
      });
    }
  }

  res.json({ queue });
});

// ── GET past-due subscriptions ─────────────────────────────────────────────

router.get("/subscriptions/past-due", requireAdmin, async (_req, res) => {
  const { data, error } = await db
    .from("subscriptions")
    .select(`
      id, user_id, property_id, status, cadence_days,
      current_period_end, last_payment_at, created_at,
      profiles:user_id (id, name, email),
      properties:property_id (id, address, city)
    `)
    .eq("status", "past_due")
    .order("current_period_end", { ascending: true })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ subscriptions: data || [] });
});

// ── POST create appointment (admin-confirmed scheduling) ──────────────────────

router.post("/appointments", requireAdmin, async (req, res) => {
  const { user_id, property_id, scheduled_at, service_type, notes } = req.body;

  if (!user_id || !scheduled_at) {
    return res.status(400).json({ error: "user_id and scheduled_at are required" });
  }

  const { data, error } = await db
    .from("appointments")
    .insert({
      user_id,
      property_id: property_id || null,
      scheduled_at,
      status: "scheduled",
      service_type: service_type || "Mosquito Service",
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ appointment: data });
});

// ── GET marketplace orders linked to an appointment ───────────────────────

router.get("/marketplace/orders/by-appointment/:appointmentId", requireAdmin, async (req, res) => {
  const { appointmentId } = req.params;

  const { data: orders, error } = await db
    .from("marketplace_orders")
    .select(`
      id, confirmation_id, status, fulfillment_status,
      total_cents, currency, created_at
    `)
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  if (!orders?.length) return res.json({ orders: [], items: {} });

  // Fetch line items for all orders
  const orderIds = orders.map((o: any) => o.id);
  const { data: allItems } = await db
    .from("marketplace_order_items")
    .select("order_id, item_name, quantity, unit_price_cents, price_type")
    .in("order_id", orderIds);

  const itemsByOrder: Record<string, any[]> = {};
  (allItems || []).forEach((item: any) => {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(item);
  });

  res.json({ orders, items: itemsByOrder });
});

// ── GET service_orders summary (validation endpoint — read-only) ──────────────

// ── POST debug: create service_order from a known marketplace_order ───────────
// Temporary diagnostic endpoint — verifies schema, permissions, and helper
// independently of Stripe webhook complexity.

/** POST /api/admin/service-orders/debug-create
 *  Body: { marketplace_order_id: string }
 *  Creates a test service_order from an existing marketplace_order.
 *  Used to verify DB permissions and helper correctness. ADMIN ONLY.
 */
router.post("/service-orders/debug-create", requireAdmin, async (req, res) => {
  const { marketplace_order_id } = req.body;

  if (!marketplace_order_id || typeof marketplace_order_id !== "string") {
    return res.status(400).json({ error: "marketplace_order_id is required" });
  }

  // Fetch the marketplace order
  const { data: order, error: fetchError } = await db
    .from("marketplace_orders")
    .select("id, user_id, property_id, appointment_id, confirmation_id, status")
    .eq("id", marketplace_order_id)
    .maybeSingle();

  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!order) return res.status(404).json({ error: "Marketplace order not found" });

  console.log("[service-orders] debug-create triggered for order:", order.id);

  // Check if service_order already exists
  const { data: existing } = await db
    .from("service_orders")
    .select("id, status")
    .eq("marketplace_order_id", order.id)
    .maybeSingle();

  if (existing) {
    return res.json({
      ok: true,
      message: "service_order already exists",
      existing,
    });
  }

  // Attempt to create
  await createMarketplaceAddOnServiceOrder({
    marketplace_order_id: order.id,
    stripe_payment_intent_id: null,
    user_id: order.user_id,
    property_id: order.property_id ?? null,
    appointment_id: order.appointment_id ?? null,
    item_count: 0,
    first_item_name: `Debug: ${order.confirmation_id}`,
  });

  // Verify it was created
  const { data: created, error: verifyError } = await db
    .from("service_orders")
    .select("id, status, source, created_at")
    .eq("marketplace_order_id", order.id)
    .maybeSingle();

  return res.json({
    ok: !!created && !verifyError,
    service_order: created ?? null,
    error: verifyError?.message ?? null,
    supabase_admin_available: !!supabaseAdmin,
    marketplace_order: { id: order.id, status: order.status, confirmation_id: order.confirmation_id },
  });
});

/** GET /api/admin/service-orders/summary — count by source/status + latest 10 */
router.get("/service-orders/summary", requireAdmin, async (_req, res) => {
  const [countsRes, latestRes] = await Promise.all([
    db
      .from("service_orders")
      .select("source, status"),
    db
      .from("service_orders")
      .select("id, source, status, title, user_id, created_at, stripe_invoice_id, marketplace_order_id")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (countsRes.error) {
    return res.status(500).json({ error: countsRes.error.message });
  }

  // Aggregate counts client-side (avoids GROUP BY compatibility concerns)
  const counts: Record<string, Record<string, number>> = {};
  for (const row of (countsRes.data || [])) {
    const s = row.source as string;
    const st = row.status as string;
    if (!counts[s]) counts[s] = {};
    counts[s][st] = (counts[s][st] ?? 0) + 1;
  }

  res.json({
    total: countsRes.data?.length ?? 0,
    by_source_status: counts,
    latest: latestRes.data ?? [],
  });
});

export default router;
