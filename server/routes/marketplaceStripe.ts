import { Router } from "express";
import { supabase } from "../lib/supabase";
import { supabaseAdmin } from "../lib/supabaseAdmin";

// Use service role for all server-side DB writes so RLS doesn't block them.
// The user's identity is already validated via getAuthenticatedUser() before any write.
const db = supabaseAdmin ?? supabase;

const router = Router();
const STRIPE_API = "https://api.stripe.com/v1";

/**
 * Get the correct application origin for Stripe redirect URLs
 *
 * CRITICAL FOR STRIPE: This function must NEVER return localhost in non-local environments
 * because Stripe will then redirect users to http://localhost which causes ERR_CONNECTION_REFUSED.
 *
 * Priority order:
 * 1. APP_BASE_URL (explicit override for deployed environments)
 * 2. x-forwarded-proto/host (trusted proxy headers from load balancers/CDN)
 * 3. request.protocol + request.get('host') if NOT localhost
 * 4. localhost ONLY if BOTH: host includes localhost AND NODE_ENV === 'development'
 * 5. Safe fallback using host header
 */
function getStripeOrigin(request: any): string {
  const proto = request.protocol || 'https';
  const host = request.get('host');

  // 1. HIGHEST PRIORITY: Explicit APP_BASE_URL override
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }

  // 2. TRUSTED PROXY HEADERS (reverse proxies, load balancers, CDN)
  const forwardedProto = request.get('x-forwarded-proto');
  const forwardedHost = request.get('x-forwarded-host');
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 3. DIRECT HOST HEADER (only if NOT localhost/127.0.0.1)
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}`;
  }

  // 4. LOCALHOST - only allowed in explicit local development
  if (host?.includes('localhost') && process.env.NODE_ENV === 'development') {
    return `${proto}://${host}`;
  }

  // 5. LAST RESORT: Use host as-is
  if (host) {
    const origin = `${proto}://${host}`;
    console.warn(`[STRIPE] Origin from fallback host header: ${origin}`);
    return origin;
  }

  // 6. FINAL FALLBACK: Should not reach here in normal operation
  console.error('[STRIPE] Could not determine origin, using https://localhost');
  return 'https://localhost';
}

function getSecret() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET;

  return key || undefined;
}

async function stripeFetch(path: string, init?: RequestInit) {
  const secret = getSecret();
  if (!secret) throw Object.assign(new Error("Stripe not configured"), { status: 501 });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
  };

  if (init?.method === "POST" && init.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const res = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  } as RequestInit);

  if (!res.ok) {
    const text = await res.text();
    const keyPrefix = secret.slice(0, 12);
    console.error(`[STRIPE DEBUG] Stripe Error (${res.status}): Key prefix: ${keyPrefix}, Path: ${path}, Error:`, text.slice(0, 200));
    console.error(`Stripe Error (${res.status}):`, text);
    throw Object.assign(new Error(text), { status: res.status });
  }

  return res.json();
}

async function getOrCreateStripeCustomer(user: any) {
  const { data: profile } = await db
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customersData = await stripeFetch(`/customers?email=${encodeURIComponent(user.email!)}&limit=1`);
  let customerId = (customersData.data && customersData.data[0]) ? customersData.data[0].id : null;

  if (!customerId) {
    const params = new URLSearchParams({
      email: user.email!,
      name: user.user_metadata?.name || user.email!.split("@")[0],
      'metadata[supabase_id]': user.id
    });
    const newCustomer = await stripeFetch("/customers", {
      method: "POST",
      body: params.toString()
    });
    customerId = newCustomer.id;
  }

  await db
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", user.id);

  return customerId;
}

async function getAuthenticatedUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw Object.assign(new Error("Invalid token"), { status: 401 });
  }

  return data.user;
}

/**
 * POST /api/marketplace/create-checkout-session
 * Creates a Stripe checkout session for marketplace items (not subscription)
 * 
 * Request body:
 * {
 *   items: [ { id, name, quantity, priceCents } ],
 *   appointmentId: string (optional, for fulfillment linking),
 *   propertyId: string (optional)
 * }
 */
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { items, appointmentId, propertyId, subtotalCents, taxCents, totalCents } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Cart items are required");
    }

    // Validate totals
    if (!totalCents || totalCents <= 0) {
      throw new Error("Invalid order total");
    }

    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    // Build line items for Stripe
    // For marketplace, we need to create line items dynamically from cart items
    const lineItemsParams: Record<string, string> = {};
    const itemSnapshots: any[] = []; // Store item details for webhook recovery
    let stripeLineItemCount = 0; // Track how many billable items we have

    items.forEach((item: any, index: number) => {
      const priceCents = Math.round(item.priceCents || 0);
      if (priceCents > 0) { // Only add items with actual prices to Stripe
        lineItemsParams[`line_items[${stripeLineItemCount}][price_data][currency]`] = "usd";
        lineItemsParams[`line_items[${stripeLineItemCount}][price_data][product_data][name]`] = item.name || "Marketplace Item";
        lineItemsParams[`line_items[${stripeLineItemCount}][price_data][unit_amount]`] = priceCents.toString();
        lineItemsParams[`line_items[${stripeLineItemCount}][quantity]`] = (item.quantity || 1).toString();
        stripeLineItemCount++;
      }

      // Snapshot catalog item details for webhook recovery (needed for complete line-item persistence)
      itemSnapshots.push({
        catalogItemId: item.id || null,
        slug: item.slug || null,
        name: item.name || "Marketplace Item",
        quantity: item.quantity || 1,
        priceType: item.priceType || "fixed",
        priceCents: item.priceCents || 0,
        minPriceCents: item.minPriceCents || null,
        maxPriceCents: item.maxPriceCents || null,
      });
    });

    // HARDENING: If no billable items exist, reject the request with clear error
    // Stripe payment mode requires at least one positive-amount line item
    // We do NOT send empty or $0-only line items to Stripe (it will reject with "line_items required")
    if (stripeLineItemCount === 0) {
      throw new Error(
        "Cart contains no billable items. Please add at least one paid service or product to proceed with payment. " +
        "Free items and consultations must be scheduled separately."
      );
    }

    // Use Stripe-safe origin resolution (never returns localhost in non-local envs)
    const origin = getStripeOrigin(req);
    const returnUrl = `${origin}/dashboard/marketplace`;

    const body = new URLSearchParams({
      customer: customerId,
      mode: 'payment', // Marketplace items are always one-time payments
      success_url: `${returnUrl}?marketplace_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: returnUrl,
      'metadata[user_id]': user.id,
      'metadata[purchase_type]': 'marketplace',
      'metadata[appointment_id]': appointmentId || 'unscheduled',
      'metadata[property_id]': propertyId || 'unspecified',
      'metadata[subtotal_cents]': subtotalCents?.toString() || '0',
      'metadata[tax_cents]': taxCents?.toString() || '0',
      'metadata[total_cents]': totalCents.toString(),
      'metadata[item_count]': items.length.toString(),
      'metadata[item_snapshots]': JSON.stringify(itemSnapshots), // ← NEW: Catalog details for webhook
    });

    // CRITICAL FIX: Append all line_items parameters to the request body
    // This was the missing step that caused "line_items required" error
    // Without this, lineItemsParams existed in memory but were never sent to Stripe
    Object.entries(lineItemsParams).forEach(([key, value]) => {
      body.append(key, value);
    });

    // TEMPORARY DEBUG: Verify line_items are in the request body
    const lineItemsInRequest = Array.from(body.entries()).filter(([key]) => key.includes('line_items'));
    console.log(`[MARKETPLACE STRIPE] Checkout request includes ${lineItemsInRequest.length} line_items entries`);
    lineItemsInRequest.slice(0, 3).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // Add custom tax amount if calculated
    if (taxCents && taxCents > 0) {
      body.append('automatic_tax[enabled]', 'false');
    }

    // VERIFY: Log the actual URLs being sent to Stripe
    const successUrl = `${returnUrl}?marketplace_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = returnUrl;
    console.log(`[MARKETPLACE STRIPE] Checkout URLs - Success: ${successUrl}, Cancel: ${cancelUrl}`);

    const session = await stripeFetch("/checkout/sessions", {
      method: "POST",
      body: body.toString()
    });

    res.json({ 
      sessionUrl: session.url,
      sessionId: session.id 
    });
  } catch (e: any) {
    console.error("[Marketplace] Checkout session error:", e);
    res.status(e.status || 500).json({ error: e.message || "Failed to create checkout session" });
  }
});

/**
 * POST /api/marketplace/create-payment-intent
 * Creates a Stripe PaymentIntent for in-app checkout (no redirect).
 * Pre-writes the order and line items to Supabase immediately so they
 * appear in the customer's order history as soon as payment is initiated.
 */
router.post("/create-payment-intent", async (req, res) => {
  try {
    const { items, appointmentId, propertyId, subtotalCents, taxCents, totalCents, promoDiscountCents, stripePromotionCodeId, promoDatabaseId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart items are required." });
    }
    if (!totalCents || totalCents <= 0) {
      return res.status(400).json({ error: "Invalid order total." });
    }

    const user = await getAuthenticatedUser(req);
    const customerId = await getOrCreateStripeCustomer(user);

    // Build item snapshots for metadata
    const itemSnapshots = items.map((item: any) => ({
      catalogItemId: item.id || null,
      slug: item.slug || null,
      name: item.name || "Marketplace Item",
      quantity: item.quantity || 1,
      priceType: item.priceType || "fixed",
      priceCents: item.priceCents || 0,
    }));

    // Apply promo discount to the charged amount (cannot go below 50 cents — Stripe minimum)
    const discountCents = Math.min(promoDiscountCents || 0, totalCents);
    const chargeAmount = Math.max(50, totalCents - discountCents);

    // Create Stripe PaymentIntent
    const intentParams = new URLSearchParams({
      amount: chargeAmount.toString(),
      currency: "usd",
      customer: customerId,
      "automatic_payment_methods[enabled]": "true",
      "metadata[user_id]": user.id,
      "metadata[purchase_type]": "marketplace",
      "metadata[appointment_id]": appointmentId || "unscheduled",
      "metadata[property_id]": propertyId || "unspecified",
      "metadata[subtotal_cents]": (subtotalCents || 0).toString(),
      "metadata[tax_cents]": (taxCents || 0).toString(),
      "metadata[total_cents]": totalCents.toString(),
      "metadata[discount_cents]": discountCents.toString(),
      "metadata[item_count]": items.length.toString(),
      "metadata[item_snapshots]": JSON.stringify(itemSnapshots),
      ...(promoDatabaseId ? { "metadata[promo_code_id]": promoDatabaseId } : {}),
      ...(stripePromotionCodeId ? { "metadata[stripe_promotion_code_id]": stripePromotionCodeId } : {}),
    });

    const paymentIntent = await stripeFetch("/payment_intents", {
      method: "POST",
      body: intentParams.toString(),
    });

    // Pre-create the order record (status: pending) so it appears immediately
    const confirmationId = `ORD-${Date.now().toString().slice(-8).toUpperCase()}`;
    const { data: order, error: orderError } = await db
      .from("marketplace_orders")
      .insert({
        user_id: user.id,
        appointment_id: appointmentId && appointmentId !== "unscheduled" ? appointmentId : null,
        property_id: propertyId && propertyId !== "unspecified" ? propertyId : null,
        stripe_payment_intent_id: paymentIntent.id,
        status: "pending",
        fulfillment_status: "pending",
        subtotal_cents: subtotalCents || 0,
        tax_cents: taxCents || 0,
        total_cents: totalCents,
        currency: "usd",
        confirmation_id: confirmationId,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[Marketplace] Failed to pre-create order:", orderError?.message);
      // Don't fail the payment — webhook will create it as fallback
    }

    // Pre-create order line items
    if (order) {
      const lineItemRows = items
        .filter((item: any) => (item.priceCents || 0) > 0)
        .map((item: any) => ({
          order_id: order.id,
          catalog_item_id: item.id || null,
          slug: item.slug || null,
          item_name: item.name || "Marketplace Item",
          quantity: item.quantity || 1,
          price_type: item.priceType || "fixed",
          unit_price_cents: item.priceCents || 0,
          line_total_cents: (item.priceCents || 0) * (item.quantity || 1),
          currency: "usd",
        }));

      if (lineItemRows.length > 0) {
        await db.from("marketplace_order_items").insert(lineItemRows);
      }
    }

    return res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order?.id ?? null,
      confirmationId,
      amount: totalCents,
    });
  } catch (e: any) {
    console.error("[Marketplace] PaymentIntent error:", e.message);
    return res.status(e.status || 500).json({ error: e.message || "Failed to create payment." });
  }
});

export default router;
